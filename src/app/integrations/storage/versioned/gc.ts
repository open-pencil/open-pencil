import { fallbackDocumentMetadata } from '../metadata'
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
import type { GarbageCollectionResult } from '../types'
import { parseDocumentHead } from './head'
import { parseVersionManifest } from './manifest'
import { readVersionManifest } from './manifest-cache'
import { isOldEnoughToDelete } from './retention'

const FALLBACK_METADATA = fallbackDocumentMetadata('')

/**
 * The garbage collection sweep. A body is deleted only when no retained manifest of any
 * document references it and it is older than the safety window; manifests are the references.
 * Young objects are never touched: an in-flight commit (body stored, head not yet) is a
 * legitimate young orphan, and a young orphan manifest may name a body a racing writer is
 * about to commit. When in doubt, bytes are kept.
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
    const head = parseDocumentHead(await getObject(config, object.key))
    // An unreadable head stops the sweep: its chain is unknown, so nothing is provably free.
    if (!head) throw new Error(`Unreadable document head: ${object.key}`)
    for (const stateId of head.history) retainedStateIds.add(stateId)
  }

  // Retained bodies: those the retained manifests name.
  const retainedBodies = new Set<string>()
  for (const stateId of retainedStateIds) {
    const parsed = await readVersionManifest(config, stateId, FALLBACK_METADATA)
    if (parsed) retainedBodies.add(parsed.manifest.bodyId)
  }

  // Orphan manifests: old ones go; young ones stay and protect their body.
  const versionObjects = await listObjects(config, STORAGE_VERSIONS_PREFIX)
  const protectedBodies = new Set(retainedBodies)
  const deletableManifests: string[] = []
  for (const object of versionObjects) {
    const stateId = stateIdFromManifestKey(object.key)
    if (!stateId || retainedStateIds.has(stateId)) continue
    if (!isOldEnoughToDelete(object.lastModified, nowMs)) {
      const parsed = parseVersionManifest(
        await getObject(config, versionManifestKey(stateId)),
        FALLBACK_METADATA
      )
      if (parsed) protectedBodies.add(parsed.manifest.bodyId)
      continue
    }
    deletableManifests.push(object.key)
  }

  // Bodies: old and unprotected, so a body shared with another document survives its delete.
  const bodyObjects = await listObjects(config, STORAGE_BODIES_PREFIX)
  const deletableBodies = bodyObjects
    .filter((object) => {
      const bodyId = bodyIdFromKey(object.key)
      return (
        bodyId !== null &&
        !protectedBodies.has(bodyId) &&
        isOldEnoughToDelete(object.lastModified, nowMs)
      )
    })
    .map((object) => object.key)

  for (const key of [...deletableManifests, ...deletableBodies]) {
    await deleteObject(config, key).catch((error: unknown) => {
      console.warn('[Storage] Garbage collection could not delete', key, error)
    })
  }
  return { deletedBodies: deletableBodies.length, deletedManifests: deletableManifests.length }
}
