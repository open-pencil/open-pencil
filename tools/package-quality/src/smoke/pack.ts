import { mkdir } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'

import { parseNpmPack, runCommand, type WorkspacePackage } from '@open-pencil/package-artifacts'
import { inspectTarball, type TarballInspection } from '@open-pencil/package-artifacts/tarball'

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
  const tarballs: string[] = []
  for (const pkg of packages) {
    const command =
      packageManager === 'bun'
        ? ['bun', 'pm', 'pack', '--ignore-scripts', '--destination', outputDirectory, '--quiet']
        : ['npm', 'pack', '--json', '--ignore-scripts', '--pack-destination', outputDirectory]
    const result = await runCommand({
      command: command[0] ?? packageManager,
      args: command.slice(1),
      cwd: join(root, pkg.directory),
      timeoutMs: 60_000
    })
    const tarball =
      packageManager === 'bun'
        ? tarballFromOutput(result.stdout, outputDirectory)
        : npmTarballFromOutput(result.stdout, outputDirectory)
    tarballs.push(tarball)
  }
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
