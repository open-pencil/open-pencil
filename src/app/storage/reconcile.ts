import type { StorageDocument } from '@/app/integrations/storage'
import { HEAD_HISTORY_LIMIT } from '@/app/integrations/storage/versioned/head'
import type { LocalCanvasMeta } from '@/app/storage/local-store'
import { bodyIsConfirmed } from '@/app/storage/local-store/meta'

/** A clean row that follows a newer remote state written by another device. */
export type RemoteUpdate = {
  document: StorageDocument
  /** The local bytes are another body than the remote one, so a later open downloads it. */
  dropLocalBody: boolean
}

export type StorageReconciliation = {
  documents: StorageDocument[]
  remoteDocumentsToSeed: StorageDocument[]
  localIdsToPurge: string[]
  /**
   * Rows with local bytes that the destination lists but has not confirmed as these bytes in
   * the versioned layout: written before body identity, or still in the legacy layout. They are
   * uploaded once, which moves them to the versioned layout and makes them evictable.
   */
  bodyUnconfirmedIds: string[]
  remoteUpdates: RemoteUpdate[]
  /**
   * Clean rows whose last publish is missing from the remote history: another device's head
   * write raced this one's and won, which a provider without conditional writes (B2) allows.
   */
  forkedIds: string[]
}

/** The row's sync state is this device's own idea of the design: it holds local edits. */
function holdsLocalWork(meta: LocalCanvasMeta): boolean {
  return meta.syncStatus !== 'synced'
}

function isFork(meta: LocalCanvasMeta, remote: StorageDocument): boolean {
  const published = meta.lastPublishedStateId
  if (published === null || !remote.versioned || !remote.history) return false
  if (remote.stateId === published || remote.history.includes(published)) return false
  // A full chain can drop a publish that is simply old; the parent it replaced tells them apart.
  if (remote.history.length < HEAD_HISTORY_LIMIT) return true
  const parent = meta.lastPublishedParentStateId
  return parent !== null && remote.history.includes(parent)
}

function remoteMoved(meta: LocalCanvasMeta, remote: StorageDocument): boolean {
  if (!remote.metadataAuthoritative) return false
  if (remote.stateId) return remote.stateId !== meta.baseStateId
  // A legacy sidecar has no state identity: a newer timestamp is the only signal.
  return remote.updatedAt > meta.updatedAt
}

function localDocument(meta: LocalCanvasMeta): StorageDocument {
  return {
    id: meta.id,
    name: meta.name,
    updatedAt: meta.updatedAt,
    sourceFormat: meta.sourceFormat,
    trashedAt: meta.trashedAt,
    metadataAuthoritative: true
  }
}

/**
 * Merge a successful remote listing with the rows on this device without reviving tombstones.
 * `local` must already be narrowed to the rows of the destination that produced `remote`.
 * A row with local work wins over the listing; a clean row follows the remote, which is how
 * edits, renames and trash from other devices arrive.
 */
export function reconcileStorageDocuments(
  local: LocalCanvasMeta[],
  remote: StorageDocument[],
  destination: string | null = null
): StorageReconciliation {
  const localById = new Map(local.map((metadata) => [metadata.id, metadata]))
  const tombstonedIds = new Set(
    local.filter((metadata) => metadata.tombstoned).map((metadata) => metadata.id)
  )
  const remoteById = new Map(remote.map((document) => [document.id, document]))
  const merged = new Map(
    remote
      .filter((document) => !tombstonedIds.has(document.id))
      .map((document) => [document.id, document])
  )
  const remoteUpdates: RemoteUpdate[] = []
  const forkedIds: string[] = []

  for (const metadata of local) {
    if (metadata.tombstoned) continue
    const remoteDocument = remoteById.get(metadata.id)
    if (remoteDocument && !holdsLocalWork(metadata)) {
      if (isFork(metadata, remoteDocument)) {
        forkedIds.push(metadata.id)
      } else if (remoteMoved(metadata, remoteDocument)) {
        remoteUpdates.push({
          document: remoteDocument,
          dropLocalBody:
            metadata.hasFig &&
            remoteDocument.bodyId !== undefined &&
            metadata.bodyId !== remoteDocument.bodyId
        })
        continue
      }
      // An unchanged remote listing never overrides what this device knows.
      if (remoteDocument.metadataAuthoritative && remoteDocument.updatedAt >= metadata.updatedAt) {
        continue
      }
    }
    merged.set(metadata.id, localDocument(metadata))
  }

  return {
    documents: [...merged.values()].sort((first, second) =>
      second.updatedAt.localeCompare(first.updatedAt)
    ),
    remoteDocumentsToSeed: remote.filter((document) => !localById.has(document.id)),
    localIdsToPurge: local
      .filter((metadata) => metadata.tombstoned && !remoteById.has(metadata.id))
      .map((metadata) => metadata.id),
    bodyUnconfirmedIds: local
      .filter(
        (metadata) =>
          !metadata.tombstoned &&
          metadata.hasFig &&
          metadata.sourceFormat !== 'deck' &&
          metadata.syncStatus === 'synced' &&
          remoteById.has(metadata.id) &&
          !(
            bodyIsConfirmed(metadata) &&
            metadata.versionedConfirmed &&
            metadata.syncDestination === destination
          )
      )
      .map((metadata) => metadata.id),
    remoteUpdates,
    forkedIds
  }
}
