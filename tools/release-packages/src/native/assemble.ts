import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { readReleaseNotes } from '#release/release-notes'
import { isEqual } from 'es-toolkit'
import { toUint8Array } from 'js-base64'
import * as v from 'valibot'

import { desktopAssets } from './catalog.ts'
import { releaseCommands } from './commands.ts'
import { createReleaseContext } from './context.ts'
import { digestFile, validateTargetManifests } from './manifest.ts'

const { identity, repository, version, paths } = createReleaseContext()
const { verifySignature } = releaseCommands(paths.root)

const directories = (await readdir(paths.nativeArtifacts)).sort()
const manifests = validateTargetManifests(
  await Promise.all(
    directories.map(async (directory) =>
      JSON.parse(await readFile(join(paths.nativeArtifacts, directory, 'manifest.json'), 'utf8'))
    )
  ),
  identity
)

const notes = await readFile(paths.notes, 'utf8')
const sourceNotes = await readReleaseNotes(join(paths.root, 'CHANGELOG.md'), version)
if (notes !== sourceNotes) throw new Error('Release notes do not match the source changelog')
const config = v.parse(
  v.object({ plugins: v.object({ updater: v.object({ pubkey: v.string() }) }) }),
  JSON.parse(await readFile(paths.tauriConfig, 'utf8'))
)

const temporary = await mkdtemp(join(tmpdir(), 'open-pencil-signatures-'))
const output = paths.output
await rm(output, { recursive: true, force: true })
await mkdir(output, { recursive: true })

const platforms: Record<string, { signature: string; url: string }> = {}

try {
  const publicKey = join(temporary, 'key.pub')
  await writeFile(publicKey, toUint8Array(config.plugins.updater.pubkey))

  for (const [index, manifest] of manifests.entries()) {
    const directory = directories[index]
    if (!directory) throw new Error('Missing artifact directory')

    const source = join(paths.nativeArtifacts, directory)
    const actualNames = (await readdir(source)).filter((name) => name !== 'manifest.json').sort()
    const expectedNames = manifest.files.map((file) => file.name).sort()

    if (!isEqual(actualNames, expectedNames)) {
      throw new Error(`Unexpected files in ${directory}`)
    }

    for (const file of manifest.files) {
      const path = join(source, file.name)
      const actual = await digestFile(path)

      if (actual.sha256 !== file.sha256 || actual.size !== file.size) {
        throw new Error(`Corrupt artifact: ${file.name}`)
      }

      await copyFile(path, join(output, file.name))
    }

    for (const asset of desktopAssets(manifest.target, version)) {
      if (!asset.signed) continue

      const signature = (await readFile(join(source, `${asset.name}.sig`), 'utf8')).trim()
      const decoded = join(temporary, `${asset.name}.minisig`)
      await writeFile(decoded, toUint8Array(signature))
      await verifySignature(join(source, asset.name), publicKey, decoded)

      for (const platform of asset.updaterKeys) {
        if (platforms[platform]) throw new Error(`Duplicate updater platform: ${platform}`)
        platforms[platform] = {
          signature,
          url: `https://github.com/${repository}/releases/download/${identity.tag}/${asset.name}`
        }
      }
    }
  }
} finally {
  await rm(temporary, { recursive: true, force: true })
}

const pubDate = new Date().toISOString()
await writeFile(
  join(output, 'latest.json'),
  JSON.stringify({ version, notes, pub_date: pubDate, platforms }, null, 2)
)

const packageFiles = (await readdir(paths.packages)).filter((name) => name.endsWith('.tgz')).sort()
if (packageFiles.length === 0) throw new Error('Missing npm artifacts')

const packages = await Promise.all(
  packageFiles.map(async (name) => ({ name, ...(await digestFile(join(paths.packages, name))) }))
)
await writeFile(
  join(output, 'release-manifest.json'),
  JSON.stringify(
    {
      ...identity,
      repository,
      workflow: `${repository}/.github/workflows/build.yml@${identity.workflowCommit}`,
      run: `https://github.com/${repository}/actions/runs/${identity.runId}/attempts/${identity.runAttempt}`,
      targets: manifests,
      packages
    },
    null,
    2
  )
)

const checksums = await Promise.all(
  (await readdir(output))
    .sort()
    .map(async (name) => `${(await digestFile(join(output, name))).sha256}  ${name}`)
)

await writeFile(join(output, 'SHA256SUMS'), `${checksums.join('\n')}\n`)
console.log(`Verified all ${manifests.length} native targets and updater signatures`)
