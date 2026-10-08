import { mkdir } from 'node:fs/promises'
import { availableParallelism } from 'node:os'
import { isAbsolute, join } from 'node:path'

import { mapAsync } from 'es-toolkit'

import {
  parseNpmPack,
  runCommand,
  type WorkspacePackage
} from '@open-pencil/package-artifacts-tools'
import {
  inspectTarball,
  type TarballInspection
} from '@open-pencil/package-artifacts-tools/tarball'

export interface PackedPackageSet {
  inspections: TarballInspection[]
  packages: WorkspacePackage[]
  tarballs: string[]
}

function tarballFromOutput(output: string, directory: string): string {
  const filename = output
    .split('\n')
    .map((line: string) => line.trim())
    .reverse()
    .find((line: string) => line.endsWith('.tgz'))
  if (!filename) throw new Error(`Package manager did not report a tarball in ${directory}`)
  return isAbsolute(filename) ? filename : join(directory, filename)
}

export async function packPublicPackages(
  root: string,
  outputDirectory: string,
  packages: WorkspacePackage[],
  packageManager: 'bun' | 'npm'
): Promise<PackedPackageSet> {
  await mkdir(outputDirectory, { recursive: true })
  const command =
    packageManager === 'bun'
      ? ['bun', 'pm', 'pack', '--ignore-scripts', '--destination', outputDirectory, '--quiet']
      : ['npm', 'pack', '--json', '--ignore-scripts', '--pack-destination', outputDirectory]
  // Packing reads only its own package, so packages pack side by side; tarballs keep their order.
  // Every pack settles before a failure is reported, so none writes into a removed directory.
  const outcomes = await mapAsync(
    packages,
    async (pkg) => {
      try {
        const result = await runCommand({
          command: command[0] ?? packageManager,
          args: command.slice(1),
          cwd: join(root, pkg.directory),
          timeoutMs: 60_000
        })
        return packageManager === 'bun'
          ? tarballFromOutput(result.stdout, outputDirectory)
          : npmTarballFromOutput(result.stdout, outputDirectory)
      } catch (error) {
        return error instanceof Error ? error : new Error(String(error))
      }
    },
    { concurrency: availableParallelism() }
  )
  const failures = outcomes.filter((outcome) => outcome instanceof Error)
  if (failures.length > 0) {
    throw new AggregateError(failures, failures.map(({ message }) => message).join('\n'))
  }
  const tarballs = outcomes.filter((outcome) => typeof outcome === 'string')
  const inspections = await Promise.all(tarballs.map(inspectTarball))
  const diagnostics = inspections.flatMap(({ diagnostics }) => diagnostics)
  if (diagnostics.length > 0) {
    throw new Error(
      diagnostics
        .map(({ packageName, field, message }) => `${packageName}: ${field} ${message}`)
        .join('\n')
    )
  }
  return { inspections, packages, tarballs }
}

function npmTarballFromOutput(output: string, directory: string): string {
  return join(directory, parseNpmPack(output).filename)
}
