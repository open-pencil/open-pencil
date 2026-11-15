import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { releaseTagSchema } from '#release/version'
import { decode } from 'js-base64'
import * as v from 'valibot'

import { ARTIFACT_TRANSFER_TIMEOUT_MS, releaseCommands } from '../native/commands.ts'
import { commitSchema, releaseVersion } from '../native/context.ts'
import { digestFile } from '../native/manifest.ts'
import { minisignPublicKey, verifyMinisign } from '../native/minisign.ts'
import { assertSignedVersion } from '../native/signature.ts'
import { CHROMIUM_FEED, chromiumAssets, chromiumTargets } from './catalog.ts'

const root = process.cwd()
const tag = v.parse(releaseTagSchema, process.env.RELEASE_TAG)
const version = releaseVersion(tag)
const tagCommit = v.parse(commitSchema, process.env.TAG_COMMIT)
const repository = v.parse(
  v.pipe(v.string(), v.regex(/^[\w.-]+\/[\w.-]+$/)),
  process.env.GITHUB_REPOSITORY
)
const { git, github } = releaseCommands(root)

// The release must exist, draft or published, and its tag must not have moved since the plan.
v.parse(
  v.pipe(v.string(), v.parseJson(), v.object({ tagName: v.literal(tag) })),
  await github(['release', 'view', tag, '--repo', repository, '--json', 'tagName'])
)
await git('fetch', '--no-tags', 'origin', `refs/tags/${tag}`)
if ((await git('rev-parse', 'FETCH_HEAD^{commit}')) !== tagCommit) {
  throw new Error(`Release tag ${tag} moved during the build`)
}

const artifacts = join(root, 'chromium-artifacts')
const config = v.parse(
  v.pipe(
    v.string(),
    v.parseJson(),
    v.object({ plugins: v.object({ updater: v.object({ pubkey: v.string() }) }) })
  ),
  await readFile(join(root, 'desktop', 'tauri.conf.json'), 'utf8')
)

// Every architecture must be present and signed for this version before anything is uploaded.
const platforms: Record<string, { signature: string; url: string }> = {}
const publicKey = minisignPublicKey(decode(config.plugins.updater.pubkey))

for (const target of chromiumTargets) {
  for (const asset of chromiumAssets(target, version)) {
    if (!asset.signed) continue

    const path = join(artifacts, asset.name)
    const signature = (await readFile(`${path}.sig`, 'utf8')).trim()
    const trusted = await verifyMinisign(path, publicKey, decode(signature))
    assertSignedVersion(trusted, version, asset.name)

    for (const platform of asset.updaterKeys) {
      platforms[platform] = {
        signature,
        url: `https://github.com/${repository}/releases/download/${tag}/${asset.name}`
      }
    }
  }
}

await writeFile(
  join(artifacts, CHROMIUM_FEED),
  JSON.stringify({ version, pub_date: new Date().toISOString(), platforms }, null, 2)
)

// Same names on every run of a release, so a rerun replaces them; the stable assets stay.
const names = (await readdir(artifacts)).sort()
await github(
  [
    'release',
    'upload',
    tag,
    ...names.map((name) => join(artifacts, name)),
    '--repo',
    repository,
    '--clobber'
  ],
  ARTIFACT_TRANSFER_TIMEOUT_MS
)

const downloaded = await mkdtemp(join(tmpdir(), 'open-pencil-chromium-verify-'))

try {
  await github(
    [
      'release',
      'download',
      tag,
      '--repo',
      repository,
      '--dir',
      downloaded,
      ...names.flatMap((name) => ['--pattern', name])
    ],
    ARTIFACT_TRANSFER_TIMEOUT_MS
  )

  for (const name of names) {
    if (
      (await digestFile(join(downloaded, name))).sha256 !==
      (await digestFile(join(artifacts, name))).sha256
    ) {
      throw new Error(`Uploaded digest mismatch: ${name}`)
    }
  }
} finally {
  await rm(downloaded, { recursive: true, force: true })
}

console.log(`Added OpenPencil Chromium ${version} to ${tag} with ${names.length} files`)
