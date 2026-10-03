import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createPublicationPlan } from '#release/workflow'
import { isEqual } from 'es-toolkit'
import * as v from 'valibot'

import { ARTIFACT_TRANSFER_TIMEOUT_MS, releaseCommands } from './commands.ts'
import { createReleaseContext } from './context.ts'
import { assertDraftReplacement, releaseSchema } from './draft.ts'
import { digestFile } from './manifest.ts'

const { identity, repository, paths } = createReleaseContext()
const { git, github } = releaseCommands(paths.root)

const releases = v
  .parse(
    v.array(v.array(releaseSchema)),
    JSON.parse(await github(['api', '--paginate', '--slurp', `repos/${repository}/releases`]))
  )
  .flat()
const release = releases.find((entry) => entry.tag_name === identity.tag)

// Re-fetch the tag and peel annotated tags before any registry/release mutation.
await git('fetch', 'origin', `refs/tags/${identity.tag}`)
const actualCommit = await git('rev-parse', 'FETCH_HEAD^{commit}')
const names = (await readdir(paths.output)).sort()
assertDraftReplacement(release, names, actualCommit, identity)

if (process.argv[2] === 'check') {
  const plan = await createPublicationPlan(paths.root)
  const published = plan.filter((entry) => entry.status === 'published')
  if (published.length > 0) {
    throw new Error('Release already has published npm packages; review provenance before recovery')
  }

  console.log('Draft, unpublished npm versions and immutable tag verified before publication')
  process.exit(0)
}

if (process.argv[2] !== 'upload') throw new Error('Expected check or upload')

if (!release) {
  await github([
    'release',
    'create',
    identity.tag,
    '--repo',
    repository,
    '--draft',
    '--verify-tag',
    '--title',
    identity.tag,
    '--notes-file',
    paths.notes
  ])
} else {
  await github([
    'release',
    'edit',
    identity.tag,
    '--repo',
    repository,
    '--title',
    identity.tag,
    '--notes-file',
    paths.notes
  ])
}

// Every asset is replaced, never skipped merely because its name already exists.
// GitHub has no atomic multi-asset upload. The release remains draft on failure.
await github(
  [
    'release',
    'upload',
    identity.tag,
    ...names.map((name) => join(paths.output, name)),
    '--repo',
    repository,
    '--clobber'
  ],
  ARTIFACT_TRANSFER_TIMEOUT_MS
)

const remote = v.parse(
  v.object({ isDraft: v.boolean(), assets: v.array(v.object({ name: v.string() })) }),
  JSON.parse(
    await github([
      'release',
      'view',
      identity.tag,
      '--repo',
      repository,
      '--json',
      'isDraft,assets'
    ])
  )
)
const remoteNames = remote.assets.map((asset) => asset.name).sort()

if (!remote.isDraft || !isEqual(remoteNames, names)) {
  throw new Error('Uploaded asset set mismatch')
}

const temporary = await mkdtemp(join(tmpdir(), 'open-pencil-release-verify-'))

try {
  await github(
    ['release', 'download', identity.tag, '--repo', repository, '--dir', temporary],
    ARTIFACT_TRANSFER_TIMEOUT_MS
  )

  for (const name of names) {
    if (
      (await digestFile(join(temporary, name))).sha256 !==
      (await digestFile(join(paths.output, name))).sha256
    ) {
      throw new Error(`Uploaded digest mismatch: ${name}`)
    }
  }
} finally {
  await rm(temporary, { recursive: true, force: true })
}

console.log(`Draft ${identity.tag} contains only the verified assets from this run`)
