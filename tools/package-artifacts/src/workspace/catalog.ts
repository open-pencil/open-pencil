import { join } from 'node:path'

import { readPackageJSON } from 'pkg-types'

import { readPackageManifest } from '../manifest/read'
import type { PackageManifest, WorkspacePackage } from '../manifest/types'
import { parseWorkspace } from './schema'

const DEPENDENCY_FIELDS = [
  'dependencies',
  'peerDependencies',
  'optionalDependencies'
] as const satisfies ReadonlyArray<keyof PackageManifest>

export async function discoverPublicPackages(root: string): Promise<WorkspacePackage[]> {
  const rootManifest = await readPackageJSON(join(root, 'package.json'))
  const packages: WorkspacePackage[] = []

  const { workspaces } = parseWorkspace(rootManifest, root)
  for (const directory of workspaces) {
    const raw = await readPackageJSON(join(root, directory, 'package.json'))
    if (raw.private === true) continue
    const manifest = await readPackageManifest(join(root, directory, 'package.json'))
    packages.push({ directory, manifest })
  }

  return packages
}

export function orderPackagesByDependencies(packages: WorkspacePackage[]): WorkspacePackage[] {
  const packageByName = new Map(packages.map((pkg) => [pkg.manifest.name, pkg]))
  const permanent = new Set<string>()
  const temporary = new Set<string>()
  const ordered: WorkspacePackage[] = []

  function visit(pkg: WorkspacePackage, path: string[]): void {
    const name = pkg.manifest.name
    if (permanent.has(name)) return
    if (temporary.has(name)) {
      throw new Error(`Workspace dependency cycle: ${[...path, name].join(' -> ')}`)
    }

    temporary.add(name)
    for (const field of DEPENDENCY_FIELDS) {
      const dependencies = pkg.manifest[field]
      if (!dependencies) continue
      for (const dependencyName of Object.keys(dependencies).sort()) {
        const dependency = packageByName.get(dependencyName)
        if (dependency) visit(dependency, [...path, name])
      }
    }
    temporary.delete(name)
    permanent.add(name)
    ordered.push(pkg)
  }

  for (const pkg of packages) visit(pkg, [])
  return ordered
}
