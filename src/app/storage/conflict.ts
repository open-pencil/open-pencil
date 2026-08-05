import type { StorageAdapter, StorageDocument } from '@/app/integrations/storage'
import { createCanvasId } from '@/app/storage/id'
import { computeBodyIdSafe } from '@/app/storage/identity/body'
import { computeStateIdentity } from '@/app/storage/identity/state'
import type { LocalCanvasMeta } from '@/app/storage/local-store'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import type { Outbox } from '@/app/storage/sync/outbox'

/**
 * Listing-time conflict detection. The workspace listing already reads every
 * sidecar, so the comparison is free — the same one the drain performs before
 * writing, surfaced before the user opens the document rather than after.
 *
 * Only a row with LOCAL divergence can conflict: a clean row simply follows
 * the remote under the existing reconcile rules (another device saving is not
 * a conflict, it is a newer version). Remote movement underneath a pending
 * local edit is the case that would otherwise tear silently at the next drain.
 */
export async function markListingConflicts(
  store: LocalCanvasStore,
  local: LocalCanvasMeta[],
  remote: StorageDocument[]
): Promise<string[]> {
  const remoteStateById = new Map(
    remote.filter((document) => document.stateId).map((document) => [document.id, document])
  )
  const conflicts: string[] = []
  for (const meta of local) {
    if (meta.tombstoned || meta.syncStatus !== 'pending' || !meta.baseStateId) continue
    const remoteDocument = remoteStateById.get(meta.id)
    if (!remoteDocument?.stateId || remoteDocument.stateId === meta.baseStateId) continue
    // Identical concurrent edits converge: our pending state IS the state the
    // remote already holds, so there is nothing to fight over.
    const { stateId: localPublishId } = await computeStateIdentity(meta.bodyId ?? '', {
      name: meta.name,
      sourceFormat: meta.sourceFormat,
      isTrashed: meta.trashedAt !== null
    })
    if (remoteDocument.stateId === localPublishId) continue
    // Re-check the row: a drain completing between the listing and this write
    // must not be stamped conflict over its own success.
    const latest = await store.getMeta(meta.id)
    if (!latest || latest.syncStatus !== 'pending') continue
    await store.updateMeta(
      meta.id,
      { syncStatus: 'conflict', lastSyncError: null },
      { expectedRevision: latest.revision }
    )
    conflicts.push(meta.id)
  }
  return conflicts
}

export type ConflictResolution = 'keep-local-copy' | 'load-remote'

export type ConflictResolutionDependencies = {
  store: LocalCanvasStore
  outbox: Outbox
  adapter: StorageAdapter
  enqueueCanvas(canvasId: string, revision: number): Promise<void>
  createId?(): string
}

/**
 * Resolve a conflicted row WITHOUT overwriting anything. Both strategies do
 * the same three things, because the spec's two buttons differ in intent, not
 * mechanics: the remote stays exactly as the other device wrote it, the local
 * divergence is preserved as a new document (nothing the user made is ever
 * destroyed by a resolution), and the original row fast-forwards to the
 * remote state — it downloads the remote body lazily on next open, like any
 * index-only row.
 *
 * The strategies differ only in what the copy is FOR: `keep-local-copy` is
 * the version the user walks away with (`(my changes)`), `load-remote` is
 * insurance against the choice they just made (`(local backup)`).
 *
 * Recovery of older OVERWRITTEN versions is deliberately not promised here —
 * that needs retained remote versions (`sync-versioned-remote-layout`).
 */
export async function resolveStorageConflict(
  canvasId: string,
  resolution: ConflictResolution,
  deps: ConflictResolutionDependencies
): Promise<{ copyId: string | null }> {
  const { store, outbox, adapter } = deps
  const row = await store.getMeta(canvasId)
  if (!row || row.syncStatus !== 'conflict') return { copyId: null }

  // Fast-forwarding blind is worse than staying conflicted: if the remote
  // state cannot be read, nothing about the row changes.
  const remote = adapter.getDocumentMetadata ? await adapter.getDocumentMetadata(canvasId) : null
  if (!remote) {
    throw new Error('The remote version could not be read. Check the connection and try again.')
  }

  // Preserve the local divergence as its own document first — before any
  // state on the original row moves.
  const bytes = row.hasFig ? await store.readFig(canvasId) : null
  let copyId: string | null = null
  if (bytes && bytes.byteLength > 0) {
    copyId = deps.createId?.() ?? createCanvasId()
    const suffix = resolution === 'keep-local-copy' ? '(my changes)' : '(local backup)'
    const bodyId = await computeBodyIdSafe(bytes, row.sourceFormat)
    // Carry the preview across. Thumbnails are keyed by document id, so a copy
    // written without one is born blank — and it depicts the LOCAL version,
    // which is exactly what this copy preserves. Resolving a conflict then
    // handed the user an unrecognisable card at the moment they most needed to
    // tell two versions apart.
    const thumbBytes = row.hasThumb ? await store.readThumb(canvasId) : null
    const copy = await store.writeCanvas({
      id: copyId,
      syncTargetId: row.syncTargetId,
      name: `${row.name} ${suffix}`,
      sourceFormat: row.sourceFormat,
      figBytes: bytes,
      thumbBytes,
      bodyId
    })
    await deps.enqueueCanvas(copyId, copy.revision)
  }

  // The conflicted job is settled by this resolution — parking was to stop
  // the write, and the user has now chosen, so nothing may retry it later.
  for (const job of await outbox.list()) {
    if (job.canvasId === canvasId) await outbox.remove(job.id)
  }

  // The original's local bytes are preserved in the copy; reclaim them so the
  // row behaves index-only and the remote body downloads on next open.
  if (bytes) await store.clearFig(canvasId)

  await store.updateMeta(
    canvasId,
    {
      name: remote.name,
      trashedAt: remote.trashedAt,
      updatedAt: remote.updatedAt,
      revision: row.revision + 1,
      bodyId: remote.bodyId ?? null,
      // The remote body IS at the destination — that is what the sidecar
      // describes — so the row may treat it as confirmed without a download.
      syncedBodyId: remote.bodyId ?? null,
      baseStateId: remote.stateId ?? null,
      syncStatus: 'synced',
      lastSyncError: null
    },
    { expectedRevision: row.revision }
  )

  return { copyId }
}
