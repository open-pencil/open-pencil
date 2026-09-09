import { readPackageJSON } from 'pkg-types'

import type { PackageManifest } from './types'

export async function readPackageManifest(path: string): Promise<PackageManifest> {
  const manifest = await readPackageJSON(path)
  if (
    typeof manifest.name !== 'string' ||
    !manifest.name ||
    typeof manifest.version !== 'string' ||
    !manifest.version
  ) {
    throw new Error(`${path}: package name and version must be nonempty strings`)
  }
  return { ...manifest, name: manifest.name, version: manifest.version }
}
