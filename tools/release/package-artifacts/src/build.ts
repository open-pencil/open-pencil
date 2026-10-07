import { join } from 'node:path'

import type { WorkspacePackage } from './manifest/types'
import { CommandError, runCommand } from './process'
import {
  discoverPublicPackages,
  groupPackagesByDependencyLevel,
  orderPackagesByDependencies
} from './workspace/catalog'
import { resolveWorkspaceRoot } from './workspace/root'

export interface BuildPublicPackagesOptions {
  log?: (message: string) => void
  output?: 'capture' | 'inherit'
  timeoutMs?: number
}

/**
 * Builds public packages level by level: a level's packages depend only on earlier levels, so
 * they build at the same time. Each build's output is printed whole when it finishes, unless
 * the caller captures it, so parallel builds do not interleave.
 */
export async function buildPublicPackages(
  root: string,
  options: BuildPublicPackagesOptions = {}
): Promise<WorkspacePackage[]> {
  const packages = await discoverPublicPackages(root)
  for (const level of groupPackagesByDependencyLevel(packages)) {
    // Every build in the level settles before a failure is reported, so none keeps writing
    // output after the caller sees the error.
    const results = await Promise.allSettled(
      level
        .filter((pkg) => pkg.manifest.scripts?.build)
        .map(async (pkg) => {
          options.log?.(`Building ${pkg.manifest.name}`)
          const print = (output: { stdout: string; stderr: string }) => {
            if (options.output === 'capture') return
            process.stdout.write(output.stdout)
            process.stderr.write(output.stderr)
          }
          try {
            print(
              await runCommand({
                command: 'bun',
                args: ['run', 'build'],
                cwd: join(root, pkg.directory),
                output: 'capture',
                timeoutMs: options.timeoutMs ?? 180_000
              })
            )
          } catch (error) {
            if (!(error instanceof CommandError)) throw error
            print(error)
            throw new Error(`Building ${pkg.manifest.name} failed: ${error.message}`, {
              cause: error
            })
          }
        })
    )
    const failures = results.flatMap((result) =>
      result.status === 'rejected' ? [result.reason] : []
    )
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) {
      throw new AggregateError(failures, `${failures.length} package builds failed`)
    }
  }
  return orderPackagesByDependencies(packages)
}

if (import.meta.main) {
  await buildPublicPackages(await resolveWorkspaceRoot(process.cwd()), { log: console.log })
}
