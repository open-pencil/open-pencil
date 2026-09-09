import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  discoverPublicPackages,
  readJSON,
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

  const { version: expectedVersion } = await readJSON<{ version: string }>(
    join(root, 'package.json')
  )
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

if (import.meta.main) {
  const diagnostics = await validatePackageMetadata(
    fileURLToPath(new URL('../../../..', import.meta.url))
  )
  if (diagnostics.length > 0) throw new Error(formatPackageDiagnostics(diagnostics))
  console.log('Package metadata is publish-safe.')
}
