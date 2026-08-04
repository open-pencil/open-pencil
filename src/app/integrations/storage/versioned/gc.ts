import {
  STORAGE_BODIES_PREFIX,
  STORAGE_DOCUMENTS_PREFIX,
  STORAGE_VERSIONS_PREFIX,
  bodyIdFromKey,
  documentIdFromHeadKey,
  stateIdFromManifestKey,
  versionManifestKey
} from '../namespace'
import { deleteObject, getObject, listObjects } from '../s3/client'
import type { S3CompatibleConfig } from '../s3/types'
import type { StorageDocumentMetadata } from '../types'
import { parseDocumentHead } from './head'
import { parseVersionManifest } from './manifest'
import { isOldEnoughToDelete } from './retention'

const FALLBACK_METADATA: StorageDocumentMetadata = {
  name: '',
  updatedAt: '',
  sourceFormat: 'fig',
  trashedAt: null
}

export type GarbageCollectionResult = {
  deletedBodies: number
  deletedManifests: number
}

/**
 * The remote GC sweep. The one invariant, stated as a rule: a body is deleted
 * only when NO retained manifest of ANY document references it AND it is
 * older than the safety window. Manifests are the actual references — heads
 * derive listings, but a body's survival is decided by manifest reference.
 *
 * Young objects are never touched: an in-flight commit (body uploaded, head
 * not yet) is a legitimate young orphan, and a young orphan manifest may still
 * name a body a racing writer is about to commit. When in doubt, keep bytes.
 */
export async function s3CollectGarbage(
  config: S3CompatibleConfig,
  nowMs: number = Date.now()
): Promise<GarbageCollectionResult> {
  // Retained states: the union of every head's history chain.
  const headObjects = await listObjects(config, STORAGE_DOCUMENTS_PREFIX)
  const retainedStateIds = new Set<string>()
  for (const object of headObjects) {
    if (!documentIdFromHeadKey(object.key)) continue
    const head = parseDocumentHead(await getObject(config, object.key).catch(() => null))
    for (const stateId of head?.history ?? []) retainedStateIds.add(stateId)
  }

  // Retained bodies: read the manifests the retained states name.
  const retainedBodies = new Set<string>()
  await Promise.all(
    [...retainedStateIds].map(async (stateId) => {
      const parsed = parseVersionManifest(
        await getObject(config, versionManifestKey(stateId)).catch(() => null),
        FALLBACK_METADATA
      )
      if (parsed) retainedBodies.add(parsed.manifest.bodyId)
    })
  )

  // Orphan manifests: unreferenced by any head. Old ones go; young ones stay
  // and protect their body (a commit may still be in flight).
  const versionObjects = await listObjects(config, STORAGE_VERSIONS_PREFIX)
  const protectedBodies = new Set(retainedBodies)
  const deletableManifests: string[] = []
  for (const object of versionObjects) {
    const stateId = stateIdFromManifestKey(object.key)
    if (!stateId || retainedStateIds.has(stateId)) continue
    if (!isOldEnoughToDelete(object.lastModified, nowMs)) {
      const parsed = parseVersionManifest(
        await getObject(config, object.key).catch(() => null),
        FALLBACK_METADATA
      )
      if (parsed) protectedBodies.add(parsed.manifest.bodyId)
      continue
    }
    deletableManifests.push(object.key)
  }

  // Bodies: old and unprotected. A body named by any retained manifest — or by
  // a young orphan — survives, including across another document's delete.
  const bodyObjects = await listObjects(config, STORAGE_BODIES_PREFIX)
  const deletableBodies: string[] = []
  for (const object of bodyObjects) {
    const bodyId = bodyIdFromKey(object.key)
    if (bodyId === null) continue
    if (protectedBodies.has(bodyId)) continue
    if (!isOldEnoughToDelete(object.lastModified, nowMs)) continue
    deletableBodies.push(object.key)
  }

  await Promise.all(
    [...deletableManifests, ...deletableBodies].map((key) =>
      deleteObject(config, key).catch(() => undefined)
    )
  )
  return { deletedBodies: deletableBodies.length, deletedManifests: deletableManifests.length }
}
