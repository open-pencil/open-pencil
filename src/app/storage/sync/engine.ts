import {
  nonSecretProviderContext,
  type StorageAdapter,
  type StorageDocumentMetadata
} from '@/app/integrations/storage'
import { StorageConflictError } from '@/app/integrations/storage/conflict'
// The owning module, not the barrel: importing this through
// `@/app/integrations/storage` closes an import cycle, and the binding is still
// in its temporal dead zone when the engine evaluates — typechecks clean, then
// throws `activeStorageProviderID is not defined` on the first pump.
import { activeStorageProviderID } from '@/app/integrations/storage/preferences'
import { evictLocalFigCache } from '@/app/storage/cache-eviction'
import { computeStateIdentity } from '@/app/storage/identity/state'
import { bodyIsConfirmed } from '@/app/storage/local-store/meta'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import type { LocalCanvasMeta } from '@/app/storage/local-store/types'
import {
  categorizeSyncFailure,
  clearSyncFailure,
  httpStatusOf,
  recordSyncFailure,
  syncFailureErrorText,
  UNKNOWN_PROVIDER
} from '@/app/storage/sync/failure'
import { reconfirmVersionedBodies } from '@/app/storage/sync/migrate-layout'
import type { Outbox } from '@/app/storage/sync/outbox'
import { setUploadProgress } from '@/app/storage/sync/progress'
import { setPendingSyncCount, setSyncUi } from '@/app/storage/sync/status'
import type { OutboxJob, SyncUiState } from '@/app/storage/sync/types'
import { providerIdOfTarget, targetIsCurrent, type StorageTargetID } from '@/app/storage/target'

const MAX_ATTEMPTS = 8
const BASE_BACKOFF_MS = 1500
const MAX_BACKOFF_MS = 60_000
const SYNC_LOCK = 'openpencil-storage-sync'

export class StorageSyncBlockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageSyncBlockedError'
  }
}

/**
 * The remote moved since the local edits' base — another device wrote, and
 * writing now would silently overwrite that work. Detection needs no provider
 * capability: compare the remote's published `stateId` against the row's
 * `baseStateId`, and let identical concurrent edits converge (remote already
 * holds exactly what we were about to publish).
 */
export { StorageConflictError }

/**
 * Preflight conflict check, run before any remote write. Returns without
 * throwing whenever detection cannot say anything honest: the adapter cannot
 * read metadata, the row has no recorded base (legacy/fresh target), or the
 * remote predates identity fields.
 *
 * This is a time-of-check/time-of-use guard, not prevention: two writers can
 * both pass against the same base and the second PUT still lands. That race
 * is detected at the next read (drain preflight or listing), and recovery of
 * the overwritten version requires retained versions — deferred to
 * `sync-versioned-remote-layout`.
 */
async function assertNoRemoteConflict(
  adapter: StorageAdapter,
  meta: LocalCanvasMeta,
  intendedStateId: string
): Promise<void> {
  if (!adapter.getDocumentMetadata || !meta.baseStateId) return
  const remote = await adapter.getDocumentMetadata(meta.id)
  if (!remote?.stateId) return
  if (remote.stateId === meta.baseStateId || remote.stateId === intendedStateId) return
  throw new StorageConflictError(
    `"${meta.name}" was changed on another device since this one synced it. Resolve the conflict before uploading.`
  )
}

/** Cancels a scheduled wake. Calling it after the wake fired is a no-op. */
export type CancelScheduled = () => void

export type ConnectivityHandlers = {
  online(): void
  offline(): void
}

/**
 * Everything the engine reaches outside itself.
 *
 * The engine is the most stateful, most concurrent and most data-destructive
 * component here, and until this seam existed none of that was reachable from a
 * test: `pumping`, `wakeTimer` and `onlineBound` were module-level, so every
 * test shared one pump flag and one real `setTimeout`. Concurrency and backoff
 * — the two defect categories that produced the hardest bugs — were unassertable.
 */
export type SyncEngineDependencies = {
  getStore: () => LocalCanvasStore
  getOutbox: () => Outbox
  /** Resolves the adapter for the target a job captured, never the live selection. */
  resolveTarget: (targetId: StorageTargetID | null) => Promise<StorageAdapter>
  isOnline: () => boolean
  subscribeConnectivity: (handlers: ConnectivityHandlers) => () => void
  schedule: (ms: number, run: () => void) => CancelScheduled
  now: () => number
  /** Jitter source in [0, 1). */
  random: () => number
  runExclusive: (key: string, run: () => Promise<void>) => Promise<void>
}

export type SyncEngine = {
  pumpOnce(): Promise<void>
  kick(): Promise<void>
  /**
   * Resolves when no pump is running.
   *
   * The enqueue helpers start a pump and return without it, so awaiting one of
   * them says the job is QUEUED, never that it ran. A caller that needs the work
   * itself — a test, above all — can await this instead of inferring completion
   * from elapsed time.
   */
  idle(): Promise<void>
  resume(): Promise<void>
  clearLocalMirror(): Promise<void>
  enqueuePutCanvas(canvasId: string, revision: number): Promise<void>
  enqueuePutMetadata(canvasId: string, revision: number): Promise<void>
  enqueuePutThumb(canvasId: string, revision: number): Promise<void>
  enqueueDeleteCanvas(canvasId: string): Promise<void>
  dispose(): void
}

export function nextSyncWakeDelay(jobs: OutboxJob[], now = Date.now()): number | null {
  if (jobs.length === 0) return null
  const nextAt = Math.min(...jobs.map((job) => job.nextAttemptAt))
  return nextAt === Number.MAX_SAFE_INTEGER ? null : Math.max(250, nextAt - now)
}

function isPermanentError(error: unknown): boolean {
  // Prefer the real status. The previous substring match on '403'/'401' fired on
  // any message that happened to contain those digits — a byte count, a port, a
  // request id — and permanently parked the document mutation behind it.
  const status = httpStatusOf(error)
  if (status != null) return status === 401 || status === 403 || status === 404
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes('access denied') ||
    msg.includes('invalid access key') ||
    msg.includes('not configured')
  )
}

/**
 * Sidecar payload for a row, carrying content identity.
 *
 * `remoteBodyId` is the body the REMOTE will actually hold once this write
 * lands — the uploaded bytes for a body put, the last confirmed body for a
 * metadata-only put. It is not necessarily the row's current `bodyId`: a body
 * edit landing mid-upload makes the remote state old-body-plus-new-metadata,
 * and the identity must describe exactly that mixed state or conflict
 * detection compares against a body the bucket has never seen.
 */
async function documentMetadata(
  meta: LocalCanvasMeta,
  remoteBodyId: string | null
): Promise<StorageDocumentMetadata & { stateId: string }> {
  const { stateId } = await computeStateIdentity(remoteBodyId ?? '', {
    name: meta.name,
    sourceFormat: meta.sourceFormat,
    isTrashed: meta.trashedAt !== null
  })
  return {
    name: meta.name,
    updatedAt: meta.updatedAt,
    sourceFormat: meta.sourceFormat,
    trashedAt: meta.trashedAt,
    ...(remoteBodyId ? { bodyId: remoteBodyId } : {}),
    stateId
  }
}

/**
 * Record a successful remote write.
 *
 * A document only counts as `synced` when its BYTES are on the remote.
 * Metadata-only puts must not claim it: renaming a document with a pending body
 * upload used to mark the row synced, which both hid the missing upload and made
 * the local blob evictable — destroying the only copy.
 *
 * Staleness is decided on body IDENTITY, never on the revision counter. A
 * rename bumps `revision` without touching a byte, so a revision comparison
 * reported the body as stale and re-uploaded the whole document; on a row with
 * no local body it demoted to `pending` with nothing to enqueue, stranding the
 * row forever.
 *
 * `targetId` is the destination the completing job was addressed to. Passing it
 * makes the write conditional on the row still pointing there.
 *
 * `stateId` is the whole-document state the acknowledged write published; it
 * becomes the row's conflict base — the remote state future edits build on.
 */
export async function markRevisionSynced(
  store: LocalCanvasStore,
  canvasId: string,
  revision: number,
  options: {
    bodyUploaded?: boolean
    targetId?: StorageTargetID | null
    stateId?: string
    /** The body confirmation came from a versioned-layout commit. */
    versioned?: boolean
  } = {}
): Promise<boolean> {
  const latest = await store.getMeta(canvasId)
  if (!latest || latest.revision !== revision || latest.tombstoned) return false
  // A completion may only confirm the destination it was addressed to. The row
  // can be retargeted while an upload is in flight, and recording the result
  // against the NEW target would claim a bucket holds bytes it has never seen —
  // after which eviction is free to delete the only copy that exists.
  if (options.targetId !== undefined && latest.syncTargetId !== options.targetId) return false
  const syncedBodyId = options.bodyUploaded ? latest.bodyId : latest.syncedBodyId
  const bodyIsCurrent = bodyIsConfirmed({ bodyId: latest.bodyId, syncedBodyId })
  // A row with no local body has nothing to upload, so it is not waiting on one.
  // `pending` here would be unrecoverable: the repair below cannot enqueue a body
  // job without bytes, leaving a permanent `pending` with an empty outbox.
  const bodyPending = latest.bodyId !== null && !bodyIsCurrent
  await store.updateMeta(
    canvasId,
    {
      syncStatus: bodyPending ? 'pending' : 'synced',
      syncedBodyId,
      baseStateId: options.stateId ?? latest.baseStateId,
      // A versioned commit proves the body at its `bodies/` address; legacy
      // completions leave the flag where it was.
      versionedConfirmed: options.versioned ? true : (latest.versionedConfirmed ?? false),
      lastSyncedAt: new Date().toISOString(),
      lastSyncError: null
    },
    { expectedRevision: revision }
  )
  return bodyIsCurrent
}

export function createSyncEngine(deps: SyncEngineDependencies): SyncEngine {
  let pumping = false
  /**
   * The pump currently running, if any.
   *
   * `kick()` already returns a promise covering the whole drain — every job, and
   * the completion writes that land `syncStatus` and the body identity. Every
   * caller threw it away, so nothing outside could tell a finished pump from one
   * still going, and the only way to wait was to guess a number of turns.
   * Keeping the promise turns that guess into a fact.
   */
  let inFlight: Promise<void> | null = null
  let cancelWake: CancelScheduled | null = null
  let unsubscribeConnectivity: (() => void) | null = null
  let disposed = false

  /**
   * Start a pump without waiting for it, but keep its promise.
   *
   * `kick()` sets `pumping` synchronously before its first `await`, so checking
   * the flag here reliably separates a pump that really started from one the
   * guard turned away — recording the latter would hand `idle()` an
   * already-resolved promise while real work was still running.
   */
  function startPump(): void {
    if (pumping) return
    const running = kick()
    inFlight = running
    void running.finally(() => {
      if (inFlight === running) inFlight = null
    })
  }

  /**
   * Resolves when no pump is running.
   *
   * Loops because finishing one pump can start another — a job enqueued
   * mid-drain, or the re-wake at the end of `kick`. The cap only stops a
   * pathological engine hanging a caller for ever.
   */
  async function idle(limit = 100): Promise<void> {
    for (let i = 0; i < limit; i++) {
      const running = inFlight
      if (!running) return
      await running.catch(() => undefined)
    }
  }

  function backoffMs(attempts: number): number {
    const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1))
    return exp + Math.floor(exp * 0.2 * deps.random())
  }

  function scheduleWake(ms: number): void {
    if (disposed) return
    cancelWake?.()
    cancelWake = deps.schedule(ms, () => {
      cancelWake = null
      startPump()
    })
  }

  function ensureConnectivity(): void {
    if (unsubscribeConnectivity || disposed) return
    unsubscribeConnectivity = deps.subscribeConnectivity({
      online: () => {
        setSyncUi('syncing')
        startPump()
      },
      offline: () => {
        setSyncUi('offline')
      }
    })
  }

  /**
   * Snapshot a failure at the moment it happens.
   *
   * Provider context is read HERE, not when the modal opens: switching
   * providers after a failure used to re-label it with the wrong endpoint.
   * `putThumb` is excluded — a stale thumbnail must not present the document
   * as broken, and it gets its own quieter per-document signal.
   */
  async function captureFailure(job: OutboxJob, error: unknown, attempts: number): Promise<void> {
    if (job.type === 'putThumb') return
    const meta = await deps.getStore().getMeta(job.canvasId)
    // The job's own target first: it is what the failed call was addressed to.
    // When neither it nor the row names a resolvable destination there is no
    // honest provider here, and labelling the failure with whatever is selected
    // now would read as "your current bucket rejected this".
    const providerId = providerIdOfTarget(job.targetId ?? meta?.syncTargetId ?? null)
    recordSyncFailure({
      operation: job.type,
      providerId: providerId ?? UNKNOWN_PROVIDER,
      providerContext: providerId ? nonSecretProviderContext(providerId) : {},
      documentIds: [job.canvasId],
      documentName: meta?.name ?? null,
      occurredAt: new Date().toISOString(),
      attempts,
      category: categorizeSyncFailure(error, deps.isOnline()),
      rawError: syncFailureErrorText(error),
      status: httpStatusOf(error)
    })
  }

  /**
   * Record a sync failure against the document, guarded by revision.
   *
   * Unguarded writes let a stale or zombie job demote a document that is healthy
   * at a newer revision to `error`, leaving a permanent false failure badge.
   *
   * `putThumb` writes a different field entirely. It used to share
   * `lastSyncError`, so a failed preview upload made a fully synced document
   * report itself as broken on the card — and the real error, if there ever was
   * one, was overwritten by the cosmetic one.
   */
  async function updateSyncFailureMeta(job: OutboxJob, message: string): Promise<void> {
    const store = deps.getStore()
    const latest = await store.getMeta(job.canvasId)
    if (!latest) return
    if (job.type === 'putThumb') {
      await store.updateMeta(job.canvasId, { lastThumbSyncError: message })
      return
    }
    await store.updateMeta(
      job.canvasId,
      { syncStatus: 'error', lastSyncError: message },
      { expectedRevision: latest.revision }
    )
  }

  /**
   * Reason text for a fully parked queue, recovered from the per-document errors
   * the engine already records. Without this the user is told "sync paused" with
   * no indication of which document failed or why.
   */
  async function describeBlockedQueue(jobs: OutboxJob[]): Promise<string> {
    const store = deps.getStore()
    const canvasIds = [...new Set(jobs.map((job) => job.canvasId))]
    const metas = await Promise.all(canvasIds.map((id) => store.getMeta(id)))
    const failures = metas.filter((meta) => meta?.lastSyncError)
    const reason = failures[0]?.lastSyncError ?? 'Storage is unavailable'
    const others = failures.length - 1
    const scope =
      failures.length > 1
        ? `${failures[0]?.name ?? 'A document'} and ${others} other ${others === 1 ? 'document' : 'documents'}`
        : (failures[0]?.name ?? `${jobs.length} pending change${jobs.length === 1 ? '' : 's'}`)
    return `${scope}: ${reason}`
  }

  /**
   * A job's target is dormant when the user has pointed storage somewhere else.
   *
   * Documents stay pinned to the destination they were queued for, which is
   * correct — their bytes belong there. But the workspace lists only the ACTIVE
   * target, so a fault on a dormant one raised a global red status for a
   * document the UI refused to show and offered no way to reach. Switching
   * provider now quiets the old destination instead of stranding the user;
   * switching back surfaces it again, because the row keeps its own state.
   */
  function targetIsDormant(targetId: StorageTargetID | null): boolean {
    if (targetId === null) return false
    const owner = providerIdOfTarget(targetId)
    // Compared against the SELECTED provider, not `targetIsCurrent`: that asks
    // whether a target still matches what its own provider points at, which
    // stays true for a bucket whose settings were never edited. A Bunny target
    // is "current" by that test long after the user moved to R2 — the question
    // here is whose workspace is on screen.
    if (owner !== null && owner !== activeStorageProviderID.value) return true
    return !targetIsCurrent(targetId)
  }

  /** Global status, raised only for the destination the user is actually using. */
  function setSyncUiForJob(job: OutboxJob, state: SyncUiState, message?: string): void {
    if (targetIsDormant(job.targetId)) return
    setSyncUi(state, message ?? null)
  }

  async function putMetadata(
    adapter: StorageAdapter,
    store: LocalCanvasStore,
    meta: LocalCanvasMeta,
    job: OutboxJob
  ): Promise<void> {
    // Write whatever the row currently says rather than bailing when the revision
    // advanced past the job — the job is "sync this canvas", not "sync revision N".
    const revision = meta.revision
    // The remote body after a metadata-only write is whatever was last confirmed
    // there — a pending body upload has not landed, so the identity must not
    // claim it.
    const written = await documentMetadata(meta, meta.syncedBodyId)
    // Preflight BEFORE writing: a remote that moved from our base stops the
    // write here, while local bytes still exist and nothing is overwritten.
    await assertNoRemoteConflict(adapter, meta, written.stateId)
    // A metadata-only version reuses the confirmed body — only sound once the
    // confirmation is a versioned-layout proof (bodies/{id} exists). Legacy
    // rows keep the sidecar until a body write migrates them.
    if (adapter.putMetadataVersion && meta.versionedConfirmed) {
      await adapter.putMetadataVersion(job.canvasId, written)
    } else {
      await adapter.putDocumentMetadata(job.canvasId, written)
    }
    await markRevisionSynced(store, job.canvasId, revision, {
      targetId: job.targetId,
      stateId: written.stateId
    })

    // A sidecar write proves nothing about the body. If the current bytes are
    // still missing remotely, queue the upload instead of leaving a row that looks
    // synced but has no remote object behind it.
    //
    // `hasFig` is not part of the condition: a row with bytes always has a
    // `bodyId`, and one without has nothing to upload. Gating on `hasFig` while
    // demoting on a revision mismatch is what stranded bodyless rows.
    const latest = await store.getMeta(job.canvasId)
    if (latest && !latest.tombstoned && latest.bodyId !== null && !bodyIsConfirmed(latest)) {
      await deps.getOutbox().enqueue({
        canvasId: job.canvasId,
        type: 'putCanvas',
        revision: latest.revision,
        // Address the repair at the row's CURRENT destination: this is a fresh
        // decision about where the bytes belong, not a continuation of the job
        // that noticed they were missing. Leaving it null made it unroutable.
        targetId: latest.syncTargetId
      })
    }
  }

  async function putCanvas(
    adapter: StorageAdapter,
    store: LocalCanvasStore,
    meta: LocalCanvasMeta,
    job: OutboxJob
  ): Promise<void> {
    if (!meta.hasFig) return
    // Upload the CURRENT revision, not the one the job was created for. A rename
    // between enqueue and drain bumps the revision, and the old code treated the
    // now-stale job as success and deleted it — losing the body upload entirely.
    const revision = meta.revision
    const bytes = await store.readFig(job.canvasId)
    if (!bytes || bytes.byteLength === 0) throw new Error('Local document missing for sync')
    // Preflight BEFORE the expensive upload: the remote body after this write
    // is the body we are about to send, so the intended identity uses it.
    const intended = await documentMetadata(meta, meta.bodyId)
    await assertNoRemoteConflict(adapter, meta, intended.stateId)
    setUploadProgress(job.canvasId, 0)
    let writtenStateId: string | undefined
    let committedVersioned = false
    try {
      if (adapter.putDocumentVersion) {
        // Versioned commit: body → manifest → head, head as the only commit
        // point. The thunk re-reads the row AT COMPLETION (after the body
        // upload), so a rename landing mid-upload is already in the committed
        // manifest — the same completion-time rule the sidecar writer follows.
        // The body half stays the dispatch snapshot's: the identity describes
        // old-body-plus-new-metadata truthfully when the row moves on mid-upload.
        const committed = await adapter.putDocumentVersion(
          job.canvasId,
          bytes,
          async () => {
            const current = await store.getMeta(job.canvasId)
            if (!current || current.tombstoned) throw new Error('Local document missing for sync')
            return documentMetadata(current, meta.bodyId)
          },
          (progress) => {
            if (progress.totalBytes) {
              setUploadProgress(job.canvasId, progress.transferredBytes / progress.totalBytes)
            }
          }
        )
        writtenStateId = committed.stateId
        committedVersioned = true
      } else {
        await adapter.putDocument(job.canvasId, bytes, (progress) => {
          if (progress.totalBytes) {
            setUploadProgress(job.canvasId, progress.transferredBytes / progress.totalBytes)
          }
        })
        // Write the sidecar with metadata read AT COMPLETION, never the dispatch
        // snapshot: a rename landing during a multi-second upload is already in
        // this re-read, so this write and the rename's trailing putMetadata carry
        // the SAME payload — identical writes, benign even where a provider (B2)
        // may process same-second same-key writes out of order. Writing the
        // dispatch snapshot produced two DIFFERENT payloads a sub-second apart.
        // A mutation between this re-read and the PUT converges on the next job;
        // reconcile bounds it — the older payload carries the older `updatedAt`.
        const latest = await store.getMeta(job.canvasId)
        if (latest && !latest.tombstoned) {
          // The remote body is the bytes just uploaded (the dispatch snapshot's
          // body), even when the re-read row has moved on — the identity describes
          // old-body-plus-new-metadata truthfully in that case.
          const written = await documentMetadata(latest, meta.bodyId)
          writtenStateId = written.stateId
          await adapter.putDocumentMetadata(job.canvasId, written)
        }
      }
    } finally {
      setUploadProgress(job.canvasId, null)
    }
    const confirmed = await markRevisionSynced(store, job.canvasId, revision, {
      bodyUploaded: true,
      targetId: job.targetId,
      stateId: writtenStateId,
      versioned: committedVersioned
    })
    if (confirmed) await evictLocalFigCache(new Set([job.canvasId]))
  }

  async function runJob(job: OutboxJob): Promise<void> {
    const store = deps.getStore()
    const meta = await store.getMeta(job.canvasId)
    // The job's captured target and nothing else — not the live selection, and
    // not the row's CURRENT target either. A job's bytes belong to the
    // destination they were queued for; a row retargeted since then still owes
    // them to the old one. Legacy jobs carrying `null` are pinned or parked by
    // `migrateLegacyOutboxJobs` at startup, so there is nothing to guess here.
    const adapter = await deps.resolveTarget(job.targetId)

    if (job.type === 'deleteCanvas') {
      await adapter.deleteDocument(job.canvasId)
      // Keep the tombstoned ROW: reconcile purges it once the remote listing
      // confirms the object is gone. Removing it here opened a race where a
      // concurrent reconcile re-seeded the canvas from a stale remote listing.
      //
      // The bytes are a different matter — the remote has acknowledged the
      // delete, so nothing will ever read them again. Reclaim them now instead
      // of holding them until a workspace refresh happens to run.
      await store.clearFig(job.canvasId)
      await store.updateMeta(job.canvasId, { syncStatus: 'synced', lastSyncError: null })
      return
    }

    if (!meta || meta.tombstoned) {
      // Nothing to put
      return
    }

    if (job.type === 'putMetadata') {
      await putMetadata(adapter, store, meta, job)
      return
    }

    if (job.type === 'putCanvas') {
      await putCanvas(adapter, store, meta, job)
      return
    }

    // Remaining job type: putThumb
    if (!adapter.putThumbnail) return
    const thumb = await store.readThumb(job.canvasId)
    if (!thumb) return
    await adapter.putThumbnail(job.canvasId, thumb)
    // Clear only when something is there to clear; the common case is a plain
    // success and does not deserve an extra IndexedDB write.
    if (meta.lastThumbSyncError !== null) {
      await store.updateMeta(job.canvasId, { lastThumbSyncError: null })
    }
  }

  let layoutSweep: Promise<void> | null = null
  let garbageCollected = false
  function ensureLayoutSweep(): Promise<void> {
    // Once per engine lifetime, before any drain: confirmations earned under
    // the fixed-key layout are re-proved against `bodies/` (or cleared) before
    // a single job runs on them. See `migrate-layout.ts`.
    layoutSweep ??= reconfirmVersionedBodies(
      deps.getStore(),
      deps.getOutbox(),
      deps.resolveTarget
    ).catch((error: unknown) => {
      console.warn('[Storage sync] layout re-confirmation sweep failed:', error)
    })
    return layoutSweep
  }

  /**
   * Nothing queued: settle the UI, and once per session let a versioned adapter
   * collect unreferenced bodies and manifests past the safety window.
   *
   * The sweep is best-effort — a failed one retries next session and must never
   * block the drain.
   */
  function onEmptyQueue(): void {
    if (deps.isOnline()) setSyncUi('idle')
    if (garbageCollected) return
    garbageCollected = true
    deps
      .resolveTarget(null)
      .then((adapter) => adapter.collectGarbage?.())
      .catch(() => undefined)
  }

  async function pumpOnce(): Promise<void> {
    await ensureLayoutSweep()
    const outbox = deps.getOutbox()
    const jobs = await outbox.list()
    // Count only what the visible workspace could actually be waiting on. Jobs
    // pinned to a provider the user has switched away from address documents
    // this workspace does not list, so counting them produced "3 waiting to
    // sync" over a grid of two — a number the user cannot reconcile, act on, or
    // clear. They stay queued and count again when that provider is selected.
    setPendingSyncCount(jobs.filter((job) => !targetIsDormant(job.targetId)).length)

    if (jobs.length === 0) {
      onEmptyQueue()
      return
    }

    if (!deps.isOnline()) {
      setSyncUi('offline')
      scheduleWake(5000)
      return
    }

    const now = deps.now()
    // Single-flight within this tab (large figs)
    const job = jobs.find((j) => j.nextAttemptAt <= now)
    if (!job) {
      const delay = nextSyncWakeDelay(jobs, now)
      if (delay != null) {
        // Waiting on a backoff — still making progress.
        setSyncUi('syncing')
        scheduleWake(delay)
        return
      }
      // Every job is parked at MAX_SAFE_INTEGER. Nothing will move without user
      // action, so report it as terminal instead of falling through to "Syncing…"
      // forever, which is what this path used to do.
      //
      // Reported for the ACTIVE destination only. Jobs pinned to a target the
      // user has switched away from are dormant, not parked-and-broken: the
      // workspace does not list their documents, so a red status for them named
      // a provider the user had left and offered nothing to act on. They stay
      // queued and revive when that target is selected again. Scoped to the
      // status alone — never to draining, since this reads live settings and a
      // preferences read that has not landed yet would strand the whole queue.
      const live = jobs.filter((candidate) => !targetIsDormant(candidate.targetId))
      if (live.length === 0) {
        if (deps.isOnline()) setSyncUi('idle')
        return
      }
      setSyncUi('blocked', await describeBlockedQueue(live))
      return
    }

    // Only claim "syncing" once we actually have a job to run, so a kick from an
    // autosave or an `online` event cannot overwrite a sticky failure state.
    setSyncUi('syncing')

    try {
      await runJob(job)
      await outbox.remove(job.id)
      const remaining = await outbox.list()
      setPendingSyncCount(remaining.length)
      if (remaining.length === 0) {
        clearSyncFailure()
        setSyncUi('idle')
      } else scheduleWake(50)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (error instanceof StorageConflictError) {
        // A conflict is not a failure: nothing about the destination is wrong,
        // and retrying would not help — the remote moved and only the user can
        // pick a winner. Park the job (resume() revives it after resolution),
        // mark the row, and say whose work is at stake. No failure snapshot:
        // that channel describes provider faults, and this is neither.
        await outbox.update({
          ...job,
          nextAttemptAt: Number.MAX_SAFE_INTEGER
        })
        const latest = await deps.getStore().getMeta(job.canvasId)
        if (latest) {
          await deps
            .getStore()
            .updateMeta(
              job.canvasId,
              { syncStatus: 'conflict', lastSyncError: null },
              { expectedRevision: latest.revision }
            )
        }
        setSyncUiForJob(job, 'conflict', message)
        return
      }
      if (error instanceof StorageSyncBlockedError) {
        await outbox.update({
          ...job,
          nextAttemptAt: Number.MAX_SAFE_INTEGER
        })
        // Record it on the document too — this branch used to leave no per-document
        // trace at all, so nothing could explain the pause afterwards.
        await updateSyncFailureMeta(job, message)
        await captureFailure(job, error, job.attempts)
        setSyncUiForJob(job, 'blocked', message)
        return
      }

      const attempts = job.attempts + 1
      const permanent = isPermanentError(error) || attempts >= MAX_ATTEMPTS
      console.warn('[Storage sync] job failed:', job.type, job.canvasId, message)

      if (permanent) {
        await updateSyncFailureMeta(job, message)
        await captureFailure(job, error, attempts)
        if (job.type !== 'putThumb') {
          // Terminal for this job: it parks below and only resume() revives it.
          setSyncUiForJob(job, 'blocked', message)
        }
        if (job.type === 'putThumb') {
          await outbox.remove(job.id)
          const remaining = await outbox.list()
          setPendingSyncCount(remaining.length)
          if (remaining.length > 0) scheduleWake(1000)
          else setSyncUi('idle')
        } else {
          // Never discard a document mutation. Keep it durable until the user
          // repairs credentials/permissions and explicitly wakes synchronization.
          await outbox.update({
            ...job,
            attempts,
            nextAttemptAt: Number.MAX_SAFE_INTEGER
          })
        }
        return
      }

      const updated: OutboxJob = {
        ...job,
        attempts,
        nextAttemptAt: deps.now() + backoffMs(attempts)
      }
      await outbox.update(updated)
      await captureFailure(job, error, attempts)
      if (job.type === 'putThumb') {
        // Quieter by construction: its own field, no `syncStatus` demotion, and
        // no global failure state. A preview upload that is still being retried
        // is not a reason to turn the whole workspace's chip red — especially
        // since `captureFailure` skips putThumb, so the detail view would have
        // had nothing to show behind it.
        await deps.getStore().updateMeta(job.canvasId, { lastThumbSyncError: message })
        setSyncUi('syncing')
      } else {
        // Transient: still retrying, so surface it as `error` rather than `blocked`.
        setSyncUiForJob(job, 'error', message)
        await deps.getStore().updateMeta(job.canvasId, {
          syncStatus: 'pending',
          lastSyncError: message
        })
      }
      // Wake for the next ready job across the whole queue — not this job's
      // full backoff, which starved other jobs that were ready sooner.
      const all = await outbox.list()
      const nextAt = Math.min(...all.map((j) => j.nextAttemptAt))
      scheduleWake(Math.max(250, nextAt - deps.now()))
    }
  }

  /** Start or continue draining the outbox. Safe to call often. */
  async function kick(): Promise<void> {
    if (disposed) return
    ensureConnectivity()
    if (pumping) return
    pumping = true
    let pumpFailed = false
    try {
      await deps.runExclusive(SYNC_LOCK, async () => {
        // Drain a few jobs per kick to avoid long tight loops blocking the tab.
        for (let i = 0; i < 3; i++) {
          const before = (await deps.getOutbox().list()).length
          await pumpOnce()
          const after = (await deps.getOutbox().list()).length
          if (after === 0 || after >= before) break
        }
      })
    } catch (error) {
      // Never let an escaped rejection strand the queue — retry shortly.
      pumpFailed = true
      console.warn('[Storage sync] pump failed:', error)
      scheduleWake(5000)
    } finally {
      pumping = false
    }
    // A job enqueued mid-pump can slip past the loop's exit check while its
    // kick was swallowed by the pumping guard — re-wake if work is already due.
    // (Skip offline — pumpOnce owns those wakes — and errors, which keep their
    // 5s backoff; re-waking would clobber it into a tight retry loop.)
    if (pumpFailed || !deps.isOnline()) return
    const jobs = await deps.getOutbox().list()
    if (jobs.some((job) => job.nextAttemptAt <= deps.now())) scheduleWake(250)
  }

  async function enqueue(
    canvasId: string,
    type: OutboxJob['type'],
    revision: number
  ): Promise<void> {
    // Capture the destination NOW. Resolving it at drain time is what let a
    // provider switch mid-queue send a document's bytes to the wrong bucket.
    const meta = await deps.getStore().getMeta(canvasId)
    await deps
      .getOutbox()
      .enqueue({ canvasId, type, revision, targetId: meta?.syncTargetId ?? null })
    startPump()
  }

  /** Retry durable work immediately after storage settings or credentials change. */
  async function resume(): Promise<void> {
    const outbox = deps.getOutbox()
    const jobs = await outbox.list()
    const now = deps.now()
    // Reset attempts too: the user repairing credentials is exactly the signal
    // that the old attempt count is stale. Without this a parked job got a single
    // retry and re-parked on the first transient blip.
    await Promise.all(jobs.map((job) => outbox.update({ ...job, attempts: 0, nextAttemptAt: now })))
    if (jobs.length > 0) setSyncUi('syncing')
    startPump()
  }

  /** After credentials cleared — drop local mirror + outbox (optional safety). */
  async function clearLocalMirror(): Promise<void> {
    await deps.getStore().clearAll()
    await deps.getOutbox().clear()
    setPendingSyncCount(0)
    setSyncUi('idle')
  }

  return {
    pumpOnce,
    kick,
    idle,
    resume,
    clearLocalMirror,
    enqueuePutCanvas: (canvasId, revision) => enqueue(canvasId, 'putCanvas', revision),
    enqueuePutMetadata: (canvasId, revision) => enqueue(canvasId, 'putMetadata', revision),
    enqueuePutThumb: (canvasId, revision) => enqueue(canvasId, 'putThumb', revision),
    enqueueDeleteCanvas: (canvasId) => enqueue(canvasId, 'deleteCanvas', 0),
    dispose: () => {
      disposed = true
      cancelWake?.()
      cancelWake = null
      unsubscribeConnectivity?.()
      unsubscribeConnectivity = null
    }
  }
}
