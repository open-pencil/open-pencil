import type { StorageAdapter, StorageDocument } from '@/app/integrations/storage'
import { createCanvasId } from '@/app/storage/id'
import { computeBodyIdSafe } from '@/app/storage/identity/body'
import { computeStateIdentity } from '@/app/storage/identity/state'
import type { LocalCanvasMeta } from '@/app/storage/local-store'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import { remoteStateFields } from '@/app/storage/sync/commit'
import type { Outbox } from '@/app/storage/sync/outbox'

/**
 * Listing-time conflict detection: a row with local work whose remote moved underneath it would
 * otherwise only be caught at its next commit. A clean row simply follows the remote.
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
    // A state this device published is not another device's write.
    if (remoteDocument.stateId === meta.lastPublishedStateId) continue
    // Identical edits converge: the remote already holds what this device would publish.
    const { stateId: localStateId } = await computeStateIdentity(meta.bodyId ?? '', {
      documentId: meta.id,
      name: meta.name,
      sourceFormat: meta.sourceFormat,
      isTrashed: meta.trashedAt !== null
    })
    if (remoteDocument.stateId === localStateId) continue
    // A commit that completed since the listing must not be stamped as a conflict.
    const latest = await store.getMeta(meta.id)
    if (latest?.syncStatus !== 'pending') continue
    await store.updateMeta(
      meta.id,
      { syncStatus: 'conflict', lastSyncError: null },
      { expectedRevision: latest.revision }
    )
    conflicts.push(meta.id)
  }
  return conflicts
}

/**
 * `keep-both` keeps this device's version as a copy when its body differs from the remote one,
 * and otherwise re-applies its metadata on top of the remote state. `use-remote` drops this
 * device's version.
 */
export type ConflictResolution = 'keep-both' | 'use-remote'

export type ConflictResolutionDependencies = {
  store: LocalCanvasStore
  outbox: Outbox
  adapter: StorageAdapter
  destination: string | null
  enqueueCanvas(canvasId: string, revision: number): Promise<void>
  enqueueMetadata(canvasId: string, revision: number): Promise<void>
  /** The copy's name, localized: "<name> (conflicted copy)". */
  copyName(name: string): string
  /** Point open editors of the design at its copy, so their edits continue there. */
  rebindOpenDesign(fromId: string, toId: string, name: string): void
  createId?(): string
  now?(): string
}

export type ConflictOutcome = {
  /** The copy holding this device's version, when one was made. */
  copyId: string | null
}

async function settleParkedJobs(outbox: Outbox, canvasId: string): Promise<void> {
  for (const job of await outbox.list()) {
    if (job.canvasId === canvasId) await outbox.remove(job.id)
  }
}

/** The row follows the remote state; its own bytes go unless they are the remote body. */
async function fastForward(
  deps: ConflictResolutionDependencies,
  row: LocalCanvasMeta,
  remote: StorageDocument
): Promise<void> {
  const keepsBytes = row.hasFig && row.bodyId !== null && row.bodyId === remote.bodyId
  if (row.hasFig && !keepsBytes) await deps.store.clearFig(row.id)
  await deps.store.updateMeta(row.id, {
    ...remoteStateFields(remote, deps.destination),
    bodyId: keepsBytes ? row.bodyId : (remote.bodyId ?? null),
    revision: row.revision + 1,
    lastPublishedStateId: null,
    lastPublishedParentStateId: null
  })
}

/** Keep this device's version as a new design, then let the original follow the remote. */
async function keepCopy(
  deps: ConflictResolutionDependencies,
  row: LocalCanvasMeta,
  remote: StorageDocument,
  bytes: Uint8Array,
  bodyId: string
): Promise<string> {
  const copyId = deps.createId?.() ?? createCanvasId()
  const name = deps.copyName(row.name)
  const copy = await deps.store.writeCanvas({
    id: copyId,
    providerId: row.providerId,
    name,
    sourceFormat: row.sourceFormat,
    updatedAt: deps.now?.() ?? new Date().toISOString(),
    figBytes: bytes,
    thumbBytes: row.hasThumb ? await deps.store.readThumb(row.id) : null,
    bodyId
  })
  // After the copy exists: an editor's next save then lands in the copy with its newest state.
  deps.rebindOpenDesign(row.id, copyId, name)
  await deps.enqueueCanvas(copyId, copy.revision)
  await fastForward(deps, row, remote)
  return copyId
}

/**
 * Metadata-only divergence makes no copy: the row adopts the remote base and body, and the newer
 * of the two names and trash states is committed on top of it.
 */
async function rebase(
  deps: ConflictResolutionDependencies,
  row: LocalCanvasMeta,
  remote: StorageDocument
): Promise<void> {
  const base = {
    baseStateId: remote.stateId ?? null,
    syncedBodyId: remote.bodyId ?? null,
    versionedConfirmed: remote.versioned === true,
    syncDestination: deps.destination,
    lastPublishedStateId: null,
    lastPublishedParentStateId: null,
    lastSyncError: null
  }
  if (row.updatedAt < remote.updatedAt) {
    await fastForward(deps, row, remote)
    return
  }
  const updated = await deps.store.updateMeta(row.id, {
    ...base,
    revision: row.revision + 1,
    syncStatus: 'pending'
  })
  if (updated) await deps.enqueueMetadata(row.id, updated.revision)
}

/**
 * Resolve a design in conflict without overwriting anything the other device wrote. When the
 * remote cannot be read, nothing changes and the design stays in conflict.
 */
export async function resolveStorageConflict(
  canvasId: string,
  resolution: ConflictResolution,
  deps: ConflictResolutionDependencies
): Promise<ConflictOutcome> {
  const row = await deps.store.getMeta(canvasId)
  if (row?.syncStatus !== 'conflict') return { copyId: null }
  if (!deps.adapter.getDocumentMetadata) throw new Error('Storage cannot read the other version')
  const remote = await deps.adapter.getDocumentMetadata(canvasId)
  await settleParkedJobs(deps.outbox, canvasId)

  if (!remote) {
    // Deleted on the other device, and nothing here to bring it back from: let it go.
    if (!row.hasFig) {
      await deps.store.remove(canvasId)
      return { copyId: null }
    }
    // Deleted on the other device: this device's version is the design again.
    const updated = await deps.store.updateMeta(canvasId, {
      syncStatus: 'pending',
      baseStateId: null,
      syncedBodyId: null,
      versionedConfirmed: false,
      lastPublishedStateId: null,
      lastPublishedParentStateId: null,
      revision: row.revision + 1
    })
    if (updated) await deps.enqueueCanvas(canvasId, updated.revision)
    return { copyId: null }
  }

  if (resolution === 'use-remote') {
    await fastForward(deps, row, remote)
    return { copyId: null }
  }
  const bytes = row.hasFig ? await deps.store.readFig(canvasId) : null
  if (bytes && bytes.byteLength > 0) {
    // Bytes saved before body identity are identified now, so they are compared, never assumed.
    const bodyId = row.bodyId ?? (await computeBodyIdSafe(bytes, row.sourceFormat))
    if (bodyId !== (remote.bodyId ?? null)) {
      return { copyId: await keepCopy(deps, row, remote, bytes, bodyId) }
    }
  }
  await rebase(deps, row, remote)
  return { copyId: null }
}
