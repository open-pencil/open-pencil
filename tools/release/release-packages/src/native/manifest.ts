import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import { isEqual, pick } from 'es-toolkit'
import * as v from 'valibot'

import { desktopAssets, desktopTargets } from './catalog.ts'
import { identitySchema, releaseVersion, sha256Schema, type ReleaseIdentity } from './context.ts'
export const artifactSchema = v.object({
  name: v.pipe(v.string(), v.regex(/^[A-Za-z0-9_.-]+$/)),
  sha256: sha256Schema,
  size: v.pipe(v.number(), v.integer(), v.minValue(1))
})
export const targetManifestSchema = v.object({
  ...identitySchema.entries,
  target: v.picklist(desktopTargets),
  files: v.array(artifactSchema)
})
const identityKeys = v.keyof(identitySchema).options

export type TargetManifest = v.InferOutput<typeof targetManifestSchema>

export async function digestFile(path: string): Promise<{ sha256: string; size: number }> {
  const bytes = await readFile(path)
  return { sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.byteLength }
}

export function validateTargetManifests(
  input: unknown[],
  identity: ReleaseIdentity
): TargetManifest[] {
  const manifests = input.map((entry) => v.parse(targetManifestSchema, entry))
  if (manifests.length !== desktopTargets.length) throw new Error('Incomplete native matrix')

  const seenTargets = new Set<string>()
  const seenFiles = new Set<string>()

  for (const manifest of manifests) {
    if (!isEqual(pick(manifest, identityKeys), identity)) {
      throw new Error('Mismatched release identity')
    }

    if (seenTargets.has(manifest.target)) throw new Error('Duplicate native target')
    seenTargets.add(manifest.target)

    const expected = desktopAssets(manifest.target, releaseVersion(identity.tag))
      .flatMap((asset) => (asset.signed ? [asset.name, `${asset.name}.sig`] : [asset.name]))
      .sort()
    const actual = manifest.files.map((file) => file.name).sort()

    if (!isEqual(expected, actual)) throw new Error(`Invalid assets for ${manifest.target}`)

    for (const name of actual) {
      if (seenFiles.has(name)) throw new Error(`Duplicate release filename: ${name}`)
      seenFiles.add(name)
    }
  }

  return manifests
}
