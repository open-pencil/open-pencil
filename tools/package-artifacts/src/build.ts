import { join } from 'node:path'

import { discoverPublicPackages, orderPackagesByDependencies } from './catalog'
import { runCommand } from './process'
import { resolveWorkspaceRoot } from './root'
import type { WorkspacePackage } from './types'

export interface BuildPublicPackagesOptions {
  log?: (message: string) => void
  output?: 'capture' | 'inherit'
  timeoutMs?: number
}

export async function buildPublicPackages(
  root: string,
  options: BuildPublicPackagesOptions = {}
): Promise<WorkspacePackage[]> {
  const packages = orderPackagesByDependencies(await discoverPublicPackages(root))
  for (const pkg of packages) {
    if (!pkg.manifest.scripts?.build) continue
    options.log?.(`Building ${pkg.manifest.name}`)
    await runCommand({
      command: 'bun',
      args: ['run', 'build'],
      cwd: join(root, pkg.directory),
      output: options.output ?? 'inherit',
      timeoutMs: options.timeoutMs ?? 180_000
    })
  }
  return packages
}

if (import.meta.main) {
  await buildPublicPackages(await resolveWorkspaceRoot(process.cwd()), { log: console.log })
}
