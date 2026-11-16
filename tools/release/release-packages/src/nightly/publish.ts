import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

import { NIGHTLY_TAG } from '#release/version'
import { isEqual } from 'es-toolkit'
import * as v from 'valibot'

import { CommandError } from '@open-pencil/package-artifacts-tools'

import { ARTIFACT_TRANSFER_TIMEOUT_MS, releaseCommands } from '../native/commands.ts'
import { createReleaseContext, isNightly } from '../native/context.ts'
import { verifyUploadedAssets } from '../native/uploaded.ts'
import { NIGHTLY_MANIFEST } from './plan.ts'

/** The feed desktop apps on the Nightly channel read; it goes up last. */
const FEED = 'latest.json'

const releaseSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({ assets: v.array(v.object({ name: v.string() })) })
)

/** Whether GitHub answered that the tag or release does not exist yet; anything else is a failure. */
function isMissing(error: unknown): boolean {
  return error instanceof CommandError && /release not found|HTTP 404/i.test(error.stderr)
}

async function unlessMissing<T>(operation: Promise<T>): Promise<T | undefined> {
  try {
    return await operation
  } catch (error) {
    if (isMissing(error)) return undefined
    throw error
  }
}

/**
 * Publishes the verified nightly as the one rolling `nightly` pre-release: moves its tag to the
 * nightly's commit, uploads this run's files with the feed after them, removes the previous
 * night's, checks every byte, and only then uploads the release manifest, which the next plan
 * reads as the commit the last complete nightly built (`plan.ts`). A run that fails before it
 * leaves the previous manifest, so the next night builds again. GitHub has no atomic upload, so
 * for a moment the feed can name a macOS archive that was just replaced, whose signature then
 * fails and the app tries again at its next check.
 */
const { identity, repository, version, paths } = createReleaseContext()
if (!isNightly(identity)) throw new Error(`${identity.tag} is not the nightly release`)
const { github } = releaseCommands(paths.root)
const names = (await readdir(paths.output)).sort()
for (const required of [FEED, NIGHTLY_MANIFEST]) {
  if (!names.includes(required)) throw new Error(`Missing ${required}`)
}

const tagged = await unlessMissing(
  github(['api', `repos/${repository}/git/ref/tags/${NIGHTLY_TAG}`])
)
if (tagged) {
  await github([
    'api',
    '-X',
    'PATCH',
    `repos/${repository}/git/refs/tags/${NIGHTLY_TAG}`,
    '-f',
    `sha=${identity.sourceCommit}`,
    '-F',
    'force=true'
  ])
} else {
  await github([
    'api',
    '-X',
    'POST',
    `repos/${repository}/git/refs`,
    '-f',
    `ref=refs/tags/${NIGHTLY_TAG}`,
    '-f',
    `sha=${identity.sourceCommit}`
  ])
}

const metadata = [
  '--repo',
  repository,
  '--title',
  version,
  '--notes-file',
  paths.notes,
  // Never GitHub's latest release, which the stable feed and the download page follow.
  '--prerelease',
  '--latest=false'
]
const viewed = await unlessMissing(
  github(['release', 'view', NIGHTLY_TAG, '--repo', repository, '--json', 'assets'])
)
const existing = viewed === undefined ? undefined : v.parse(releaseSchema, viewed)
if (!existing) {
  await github(['release', 'create', NIGHTLY_TAG, '--verify-tag', ...metadata])
}

const upload = (files: string[]) =>
  github(
    [
      'release',
      'upload',
      NIGHTLY_TAG,
      ...files.map((name) => join(paths.output, name)),
      '--repo',
      repository,
      '--clobber'
    ],
    ARTIFACT_TRANSFER_TIMEOUT_MS
  )
const published = names.filter((name) => name !== NIGHTLY_MANIFEST)
await upload(published.filter((name) => name !== FEED))
await upload([FEED])
if (existing) await github(['release', 'edit', NIGHTLY_TAG, ...metadata])

for (const { name } of existing?.assets ?? []) {
  if (!names.includes(name)) {
    await github(['release', 'delete-asset', NIGHTLY_TAG, name, '--repo', repository, '--yes'])
  }
}

const assetNames = async () =>
  v
    .parse(
      releaseSchema,
      await github(['release', 'view', NIGHTLY_TAG, '--repo', repository, '--json', 'assets'])
    )
    .assets.map(({ name }) => name)
    .sort()
const assertAssets = (actual: string[], expected: string[]) => {
  if (!isEqual(actual, expected)) {
    throw new Error('The nightly release carries other files than this run built')
  }
}

// Until it goes up last, the manifest is the previous night's, or absent before the first one.
assertAssets(
  (await assetNames()).filter((name) => name !== NIGHTLY_MANIFEST),
  published
)
await verifyUploadedAssets({
  github,
  repository,
  tag: NIGHTLY_TAG,
  names: published,
  directory: paths.output
})
await upload([NIGHTLY_MANIFEST])
assertAssets(await assetNames(), names)
await verifyUploadedAssets({
  github,
  repository,
  tag: NIGHTLY_TAG,
  names: [NIGHTLY_MANIFEST],
  directory: paths.output
})
console.log(`Nightly ${version} published from ${identity.sourceCommit}`)
