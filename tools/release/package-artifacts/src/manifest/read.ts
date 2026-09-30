import { readPackageJSON } from 'pkg-types'
import * as v from 'valibot'

import { parseJSONObject } from '../json'
import { packageManifestSchema } from './schema'
import type { PackageManifest } from './types'

export async function readPackageManifest(path: string): Promise<PackageManifest> {
  return validatePackageIdentity(await readPackageJSON(path), path)
}

function validatePackageIdentity(manifest: Record<string, unknown>, path: string): PackageManifest {
  const parsed = v.safeParse(packageManifestSchema, manifest)
  if (!parsed.success) {
    throw new Error(`${path}: invalid package manifest: ${v.summarize(parsed.issues)}`)
  }
  return parsed.output
}

export function parsePackageManifest(text: string, context: string): PackageManifest {
  return validatePackageIdentity(parseJSONObject(text, context), context)
}
