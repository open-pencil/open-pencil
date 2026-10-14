import type {
  CommittedVersion,
  StorageAdapter,
  StorageDocument,
  StorageDocumentMetadata,
  VersionCommitBase
} from '@/app/integrations/storage'
import { evictLocalFigCache } from '@/app/storage/cache-eviction'
import { computeBodyIdSafe } from '@/app/storage/identity/body'
import { computeStateIdentity } from '@/app/storage/identity/state'
import { bodyIsConfirmed } from '@/app/storage/local-store/meta'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import type { LocalCanvasMeta } from '@/app/storage/local-store/types'
import type { OutboxJob } from '@/app/storage/sync/types'

/** What a job needs to commit one design to its destination. */
export type CommitContext = {
  adapter: StorageAdapter
  store: LocalCanvasStore
  job: OutboxJob
  /** The destination the adapter writes to now; confirmations are recorded against it. */
  destination: string | null
  onProgress(fraction: number | null): void
}

/**
 * The metadata a commit publishes for a row, with its state identity. `remoteBodyId` is the body
 * the destination holds once the write lands: the uploaded body for a body commit, the confirmed
 * one for a metadata-only commit.
 */
export async function documentMetadata(
  meta: LocalCanvasMeta,
  remoteBodyId: string | null
): Promise<StorageDocumentMetadata & { stateId: string }> {
  const { stateId } = await computeStateIdentity(remoteBodyId ?? '', {
    documentId: meta.id,
    name: meta.name,
    sourceFormat: meta.sourceFormat,
    isTrashed: meta.trashedAt !== null
  })
  const metadata: StorageDocumentMetadata & { stateId: string } = {
    name: meta.name,
    updatedAt: meta.updatedAt,
    sourceFormat: meta.sourceFormat,
    trashedAt: meta.trashedAt,
    stateId
  }
  if (remoteBodyId) metadata.bodyId = remoteBodyId
  return metadata
}

export type SyncedRevision = {
  /** The body the commit stored, when it stored one. */
  uploadedBodyId?: string | null
  /** The state the commit published; it becomes the base of later edits. */
  stateId?: string
  parentStateId?: string | null
  /** The confirmation came from a versioned commit. */
  versioned?: boolean
  destination?: string | null
  /** False when no head holds the state, as with a legacy sidecar: it is a base, not a publish. */
  publish?: boolean
}

/**
 * Record a completed commit. The publish is recorded even when the row moved on during the
 * upload, so the conflict check can tell this device's own state from another device's; the base
 * advances only for the revision that was committed. A body counts as stored by content identity,
 * so a rename during the upload does not send the same bytes again. Returns whether the row's
 * current body is now confirmed at the destination.
 */
export async function markRevisionSynced(
  store: LocalCanvasStore,
  canvasId: string,
  revision: number,
  synced: SyncedRevision = {}
): Promise<boolean> {
  const latest = await store.getMeta(canvasId)
  if (!latest || latest.tombstoned) return false
  const uploaded = synced.uploadedBodyId ?? null
  const bodyStored = uploaded !== null && latest.bodyId === uploaded
  const confirmation = bodyStored
    ? {
        syncedBodyId: uploaded,
        versionedConfirmed: synced.versioned === true || latest.versionedConfirmed,
        syncDestination: synced.destination ?? latest.syncDestination
      }
    : {}
  const publish =
    synced.stateId && synced.publish !== false
      ? {
          lastPublishedStateId: synced.stateId,
          lastPublishedParentStateId: synced.parentStateId ?? null
        }
      : {}

  if (latest.revision !== revision) {
    await store.updateMeta(
      canvasId,
      { ...publish, ...confirmation },
      { expectedRevision: latest.revision }
    )
    return false
  }

  const syncedBodyId = bodyStored ? uploaded : latest.syncedBodyId
  const bodyIsCurrent = bodyIsConfirmed({ bodyId: latest.bodyId, syncedBodyId })
  // A row without local bytes has nothing to upload, so it is not waiting on one.
  const bodyPending = latest.hasFig && latest.bodyId !== null && !bodyIsCurrent
  await store.updateMeta(
    canvasId,
    {
      ...publish,
      syncedBodyId,
      versionedConfirmed: synced.versioned === true || latest.versionedConfirmed,
      syncDestination: synced.destination ?? latest.syncDestination,
      baseStateId: synced.stateId ?? latest.baseStateId,
      syncStatus: bodyPending ? 'pending' : 'synced',
      lastSyncedAt: new Date().toISOString(),
      lastSyncError: null
    },
    { expectedRevision: revision }
  )
  return bodyIsCurrent
}

/**
 * Confirmations belong to the destination that gave them. When storage now points elsewhere the
 * row starts over there: it uploads again rather than claiming bytes the new bucket never got,
 * and it has no base there, so it cannot report a false conflict.
 */
export async function rebaseOnDestination(
  store: LocalCanvasStore,
  meta: LocalCanvasMeta,
  destination: string | null
): Promise<LocalCanvasMeta> {
  if (meta.syncDestination === null || meta.syncDestination === destination) return meta
  return (
    (await store.updateMeta(meta.id, {
      syncedBodyId: null,
      baseStateId: null,
      lastPublishedStateId: null,
      lastPublishedParentStateId: null,
      versionedConfirmed: false,
      syncDestination: null
    })) ?? meta
  )
}

function commitBase(meta: LocalCanvasMeta): VersionCommitBase {
  return { baseStateId: meta.baseStateId, lastPublishedStateId: meta.lastPublishedStateId }
}

function bodyIsStoredHere(meta: LocalCanvasMeta, destination: string | null): boolean {
  return bodyIsConfirmed(meta) && meta.versionedConfirmed && meta.syncDestination === destination
}

/**
 * A slide deck's stored body is never rewritten here: nothing in this build edits one. Only a
 * deck that has never been stored (a conflict copy) uploads its body.
 */
function bodyMayUpload(meta: LocalCanvasMeta): boolean {
  return meta.sourceFormat !== 'deck' || (meta.baseStateId === null && meta.syncedBodyId === null)
}

async function settleUnchanged(context: CommitContext, meta: LocalCanvasMeta): Promise<void> {
  await markRevisionSynced(context.store, meta.id, meta.revision, {
    destination: context.destination
  })
}

/**
 * Commit the row's current body and metadata as one version. The body is skipped when the
 * destination already holds it.
 */
export async function commitCanvas(context: CommitContext, meta: LocalCanvasMeta): Promise<void> {
  const { store, adapter, job } = context
  if (!meta.hasFig || !bodyMayUpload(meta) || bodyIsStoredHere(meta, context.destination)) {
    await commitMetadata(context, meta)
    return
  }
  const revision = meta.revision
  const bytes = await store.readFig(meta.id)
  if (!bytes || bytes.byteLength === 0) throw new Error('Local document missing for sync')
  // A row written before body identity existed: identify its bytes once.
  const bodyId = meta.bodyId ?? (await computeBodyIdSafe(bytes, meta.sourceFormat))
  if (meta.bodyId === null) {
    await store.updateMeta(meta.id, { bodyId }, { expectedRevision: revision })
  }

  context.onProgress(0)
  let committed: CommittedVersion
  try {
    committed = await adapter.putDocumentVersion(
      meta.id,
      bytes,
      // Read again after the upload, so a rename during it is in the committed manifest; the
      // body half stays the one being uploaded.
      async () => {
        const current = await store.getMeta(meta.id)
        if (!current || current.tombstoned) throw new Error('Local document missing for sync')
        return documentMetadata(current, bodyId)
      },
      (progress) => {
        if (progress.totalBytes) context.onProgress(progress.transferredBytes / progress.totalBytes)
      },
      { expectedBase: commitBase(meta), retry: job.attempts > 0 }
    )
  } finally {
    context.onProgress(null)
  }
  const confirmed = await markRevisionSynced(store, meta.id, revision, {
    uploadedBodyId: bodyId,
    stateId: committed.stateId,
    parentStateId: committed.parentStateId,
    versioned: true,
    destination: context.destination
  })
  if (confirmed) await evictLocalFigCache(new Set([meta.id]))
}

/**
 * Commit a metadata change (a rename, the trash, a restore). A versioned design gets a new
 * manifest that reuses its stored body, so no body bytes move; a design still in the legacy
 * layout keeps its sidecar until a body commit moves it. A row whose own bytes are not stored yet
 * commits them in the same version instead.
 */
export async function commitMetadata(context: CommitContext, meta: LocalCanvasMeta): Promise<void> {
  const { store, adapter } = context
  const bodyWaiting =
    bodyMayUpload(meta) && meta.hasFig && !bodyIsStoredHere(meta, context.destination)
  if (bodyWaiting) {
    await commitCanvas(context, meta)
    return
  }
  const written = await documentMetadata(meta, meta.syncedBodyId)
  if (written.stateId === meta.baseStateId) {
    await settleUnchanged(context, meta)
    return
  }
  if (meta.versionedConfirmed && meta.syncedBodyId) {
    const committed = await adapter.putMetadataVersion(meta.id, written, {
      expectedBase: commitBase(meta)
    })
    await markRevisionSynced(store, meta.id, meta.revision, {
      stateId: committed.stateId,
      parentStateId: committed.parentStateId,
      versioned: true,
      destination: context.destination
    })
    return
  }
  if (!adapter.putDocumentMetadata) {
    throw new Error('Storage cannot record this design’s metadata')
  }
  await adapter.putDocumentMetadata(meta.id, written)
  // The legacy layout has no head, so this state is never in a head's history: recording it as a
  // publish would make the next listing see a fork once another device moves the design on.
  await markRevisionSynced(store, meta.id, meta.revision, {
    stateId: written.stateId,
    publish: false,
    destination: context.destination
  })
}

/** The row fast-forwarded to a remote state: index-only unless its bytes are that body. */
export function remoteStateFields(remote: StorageDocument, destination: string | null) {
  return {
    name: remote.name,
    trashedAt: remote.trashedAt,
    updatedAt: remote.updatedAt,
    sourceFormat: remote.sourceFormat,
    syncedBodyId: remote.bodyId ?? null,
    baseStateId: remote.stateId ?? null,
    versionedConfirmed: remote.versioned === true,
    syncDestination: destination,
    syncStatus: 'synced' as const,
    lastSyncError: null
  }
}

/** Outcome of a permanent delete: done, or kept because another device brought it back. */
export type DeleteOutcome = 'deleted' | 'kept'

/**
 * Permanently delete a design at its destination. When another device restored or edited it
 * after this one last synced, the delete is abandoned: the row comes back as the remote has it.
 */
export async function deleteCanvas(
  context: CommitContext,
  meta: LocalCanvasMeta | null
): Promise<DeleteOutcome> {
  const { store, adapter, job } = context
  if (meta && adapter.getDocumentMetadata) {
    const remote = await adapter.getDocumentMetadata(job.canvasId)
    const restoredElsewhere =
      remote?.trashedAt === null &&
      remote.stateId !== undefined &&
      remote.stateId !== meta.baseStateId &&
      remote.stateId !== meta.lastPublishedStateId
    if (remote && restoredElsewhere) {
      const keepsBytes = meta.hasFig && meta.bodyId !== null && meta.bodyId === remote.bodyId
      if (meta.hasFig && !keepsBytes) await store.clearFig(job.canvasId)
      await store.updateMeta(job.canvasId, {
        ...remoteStateFields(remote, context.destination),
        bodyId: keepsBytes ? meta.bodyId : (remote.bodyId ?? null),
        revision: meta.revision + 1,
        tombstoned: false
      })
      return 'kept'
    }
  }
  await adapter.deleteDocument(job.canvasId)
  // Keep the tombstoned row until a listing confirms the delete, so a stale listing cannot
  // bring the design back; its bytes are never read again.
  await store.clearFig(job.canvasId)
  await store.updateMeta(job.canvasId, { syncStatus: 'synced', lastSyncError: null })
  return 'deleted'
}
