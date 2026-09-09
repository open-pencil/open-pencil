import { readPackageJSON } from 'pkg-types'

import { parseJSONObject } from './npm-output'
import type { PackageManifest } from './types'

export async function readPackageManifest(path: string): Promise<PackageManifest> {
  return validatePackageIdentity(await readPackageJSON(path), path)
}

function validatePackageIdentity(manifest: Record<string, unknown>, path: string): PackageManifest {
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

export function parsePackageManifest(text: string, context: string): PackageManifest {
  return validatePackageIdentity(parseJSONObject(text, context), context)
}
