import { readPackageJSON } from 'pkg-types'
import * as v from 'valibot'

import { parseJSONObject } from './npm-output'
import type { PackageManifest } from './types'

export async function readPackageManifest(path: string): Promise<PackageManifest> {
  return validatePackageIdentity(await readPackageJSON(path), path)
}

const packageIdentitySchema = v.looseObject({
  name: v.pipe(v.string(), v.nonEmpty()),
  version: v.pipe(v.string(), v.nonEmpty())
})

function validatePackageIdentity(manifest: Record<string, unknown>, path: string): PackageManifest {
  const parsed = v.safeParse(packageIdentitySchema, manifest)
  if (!parsed.success) {
    throw new Error(`${path}: package name and version must be nonempty strings`)
  }
  return parsed.output
}

export function parsePackageManifest(text: string, context: string): PackageManifest {
  return validatePackageIdentity(parseJSONObject(text, context), context)
}
