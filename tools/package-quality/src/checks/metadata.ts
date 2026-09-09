import { join } from 'node:path'

import {
  discoverPublicPackages,
  readPackageManifest,
  validateManifest,
  type PackageDiagnostic
} from '@open-pencil/package-artifacts'

export async function validatePackageMetadata(root: string): Promise<PackageDiagnostic[]> {
  const packages = await discoverPublicPackages(root)
  if (packages.length === 0) {
    return [
      { field: 'workspaces', message: 'no public packages discovered', packageName: '<root>' }
    ]
  }

  const { version: expectedVersion } = await readPackageManifest(join(root, 'package.json'))
  const diagnostics = packages.flatMap(({ manifest }) => validateManifest(manifest))
  for (const { manifest } of packages) {
    if (manifest.version !== expectedVersion) {
      diagnostics.push({
        packageName: manifest.name,
        field: 'version',
        message: `${manifest.version} must match ${expectedVersion}`
      })
    }
  }
  return diagnostics
}

export function formatPackageDiagnostics(diagnostics: PackageDiagnostic[]): string {
  return diagnostics
    .map(({ packageName, field, message }) => `${packageName}: ${field} ${message}`)
    .join('\n')
}
