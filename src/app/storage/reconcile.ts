import type { StorageDocument } from '@/app/integrations/storage'
import type { LocalCanvasMeta } from '@/app/storage/local-store'

export type StorageReconciliation = {
  documents: StorageDocument[]
  remoteDocumentsToSeed: StorageDocument[]
  localIdsToPurge: string[]
  /**
   * Rows holding local bytes whose remote copy cannot be verified — written
   * before body identity existed, so nothing records WHICH bytes are up there.
   *
   * Listing membership deliberately does NOT confirm them. It proves only that
   * *a* body exists remotely, and marking these rows confirmed would let
   * eviction delete a local copy the remote may never have received. The caller
   * re-uploads them instead: one conservative round trip buys a real
   * confirmation, after which the row is genuinely evictable. Without this the
   * cache budget is never enforced for existing installs and local storage grows
   * without bound.
   */
  bodyUnconfirmedIds: string[]
  /**
   * Rows that claim to be `synced`, are absent from this listing, and hold no
   * local bytes. Nothing on this device can open them and nothing at the target
   * can supply them, so they are surfaced as UNAVAILABLE instead of looking
   * ordinary right up until the open fails.
   *
   * This is NOT a deletion signal and must never become one. Appwrite replaces
   * a body by deleting it and re-uploading, because its files are immutable by
   * id, so a document another device is mid-replacement on is genuinely missing
   * from a listing for the length of that upload. Absence therefore has two
   * causes — deleted elsewhere, and being rewritten elsewhere — and this
   * function cannot tell them apart. "Cannot be opened right now" is true under
   * both readings; "deleted" is true under only one.
   *
   * Derived fresh from every listing and never persisted, which is what makes
   * recovery automatic: the first listing that includes the row again simply
   * does not report it, and the row is ordinary once more with no user action.
   *
   * A row holding local bytes is never reported here however the listing looks.
   * Local bytes are openable on their own; the remote copy is a backup of them.
   */
  unavailableIds: string[]
}

/**
 * Merge a successful remote listing with pending local work without reviving
 * tombstones.
 *
 * `local` must already be narrowed to the rows belonging to the target that
 * produced `remote`. Every absence-sensitive output here reads a missing id as
 * "missing from ITS OWN target", which is only true under that narrowing.
 */
export function reconcileStorageDocuments(
  local: LocalCanvasMeta[],
  remote: StorageDocument[]
): StorageReconciliation {
  const localById = new Map(local.map((metadata) => [metadata.id, metadata]))
  const tombstonedIds = new Set(
    local.filter((metadata) => metadata.tombstoned).map((metadata) => metadata.id)
  )
  const remoteIds = new Set(remote.map((document) => document.id))
  const merged = new Map(
    remote
      .filter((document) => !tombstonedIds.has(document.id))
      .map((document) => [document.id, document])
  )

  for (const metadata of local) {
    if (metadata.tombstoned) continue
    if (metadata.syncStatus === 'synced' && merged.has(metadata.id)) continue
    merged.set(metadata.id, {
      id: metadata.id,
      name: metadata.name,
      updatedAt: metadata.updatedAt,
      sourceFormat: metadata.sourceFormat,
      trashedAt: metadata.trashedAt,
      metadataAuthoritative: true
    })
  }

  return {
    documents: [...merged.values()].sort((first, second) =>
      second.updatedAt.localeCompare(first.updatedAt)
    ),
    remoteDocumentsToSeed: remote.filter((document) => !localById.has(document.id)),
    localIdsToPurge: local
      .filter((metadata) => metadata.tombstoned && !remoteIds.has(metadata.id))
      .map((metadata) => metadata.id),
    bodyUnconfirmedIds: local
      .filter(
        (metadata) =>
          !metadata.tombstoned &&
          metadata.hasFig &&
          metadata.syncedBodyId === null &&
          remoteIds.has(metadata.id)
      )
      .map((metadata) => metadata.id),
    unavailableIds: local
      .filter(
        (metadata) =>
          !metadata.tombstoned &&
          !metadata.hasFig &&
          metadata.syncStatus === 'synced' &&
          !remoteIds.has(metadata.id)
      )
      .map((metadata) => metadata.id)
  }
}
