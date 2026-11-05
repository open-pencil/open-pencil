import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

import { RELEASE_WORKFLOW_PATH } from '#release/provenance'

import { ARTIFACT_TRANSFER_TIMEOUT_MS, releaseCommands } from './commands.ts'
import { createReleaseContext } from './context.ts'

/**
 * Verifies each release file against the attestation bundle: signed by this repository's
 * `build.yml` at the workflow commit that built it, on a GitHub-hosted runner.
 */
export async function verifyAttestations(
  context: ReturnType<typeof createReleaseContext>,
  bundle: string,
  commands = releaseCommands(context.paths.root)
): Promise<void> {
  const { repository, identity, paths } = context
  const files = (await readdir(paths.output, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .toSorted()
  if (files.length === 0) throw new Error(`No release files in ${paths.output}`)
  for (const file of files) {
    await commands.github(
      [
        'attestation',
        'verify',
        join(paths.output, file),
        '--bundle',
        bundle,
        '--repo',
        repository,
        '--signer-workflow',
        `${repository}/${RELEASE_WORKFLOW_PATH}`,
        '--signer-digest',
        identity.workflowCommit,
        '--deny-self-hosted-runners'
      ],
      ARTIFACT_TRANSFER_TIMEOUT_MS
    )
  }
  console.log(`Verified attestations for ${files.length} release files`)
}

if (import.meta.main) {
  const bundle = process.env.ATTESTATION_BUNDLE
  if (!bundle) throw new Error('Missing ATTESTATION_BUNDLE')
  await verifyAttestations(createReleaseContext(), bundle)
}
