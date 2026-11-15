import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

import { resolveWorkspaceRoot, runCommand } from '@open-pencil/package-artifacts-tools'

/** The official deployments, one folder each with its `wrangler.jsonc`. */
export async function officialDeployments(root: string): Promise<string[]> {
  const directory = join(root, 'packages/cloud/deploy/openpencil')
  const entries = await readdir(directory, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(directory, entry.name))
    .toSorted()
}

/** Bundles every official Worker with wrangler, without deploying, around the built Cloud site. */
export async function bundleOfficialWorkers(root: string, execute = runCommand): Promise<void> {
  const deployments = await officialDeployments(root)
  if (deployments.length === 0) throw new Error('No official deployments')
  for (const cwd of deployments) {
    await execute({
      command: 'bunx',
      args: ['wrangler', 'deploy', '--dry-run', '--assets', join(root, 'dist-cloud')],
      cwd,
      output: 'inherit'
    })
  }
}

if (import.meta.main) {
  await bundleOfficialWorkers(await resolveWorkspaceRoot(import.meta.dir))
}
