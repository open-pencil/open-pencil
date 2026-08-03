import { IS_BROWSER } from '@open-pencil/core/constants'

import {
  activeStorageProviderID,
  createActiveStorageAdapter,
  storageCredentialStatuses,
  storagePreferencesComplete,
  storageProviderRegistry,
  type StorageAdapter,
  type StorageDocumentMetadata,
  type StorageProviderID
} from '@/app/integrations/storage'
import { evictLocalFigCache } from '@/app/storage/cache-eviction'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import { bodyIsConfirmed } from '@/app/storage/local-store/meta'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import type { LocalCanvasMeta } from '@/app/storage/local-store/types'
import { getOutbox, type Outbox } from '@/app/storage/sync/outbox'
import { setUploadProgress } from '@/app/storage/sync/progress'
import { setPendingSyncCount, setSyncUi } from '@/app/storage/sync/status'
import type { OutboxJob } from '@/app/storage/sync/types'

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
  resolveTarget: (targetId: StorageProviderID | null) => Promise<StorageAdapter>
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

/** HTTP status carried by adapter errors (S3HttpError, AppwriteHttpError, …). */
function httpStatusOf(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('status' in error)) return null
  const status = (error as { status: unknown }).status
  return typeof status === 'number' ? status : null
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

function documentMetadata(meta: LocalCanvasMeta): StorageDocumentMetadata {
  return {
    name: meta.name,
    updatedAt: meta.updatedAt,
    sourceFormat: meta.sourceFormat,
    trashedAt: meta.trashedAt
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
 */
export async function markRevisionSynced(
  store: LocalCanvasStore,
  canvasId: string,
  revision: number,
  options: { bodyUploaded?: boolean } = {}
): Promise<boolean> {
  const latest = await store.getMeta(canvasId)
  if (!latest || latest.revision !== revision || latest.tombstoned) return false
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
      lastSyncedAt: new Date().toISOString(),
      lastSyncError: null
    },
    { expectedRevision: revision }
  )
  return bodyIsCurrent
}

export function createSyncEngine(deps: SyncEngineDependencies): SyncEngine {
  let pumping = false
  let cancelWake: CancelScheduled | null = null
  let unsubscribeConnectivity: (() => void) | null = null
  let disposed = false

  function backoffMs(attempts: number): number {
    const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1))
    return exp + Math.floor(exp * 0.2 * deps.random())
  }

  function scheduleWake(ms: number): void {
    if (disposed) return
    cancelWake?.()
    cancelWake = deps.schedule(ms, () => {
      cancelWake = null
      void kick()
    })
  }

  function ensureConnectivity(): void {
    if (unsubscribeConnectivity || disposed) return
    unsubscribeConnectivity = deps.subscribeConnectivity({
      online: () => {
        setSyncUi('syncing')
        void kick()
      },
      offline: () => {
        setSyncUi('offline')
      }
    })
  }

  /**
   * Record a sync failure against the document, guarded by revision.
   *
   * Unguarded writes let a stale or zombie job demote a document that is healthy
   * at a newer revision to `error`, leaving a permanent false failure badge.
   * `putThumb` never touches `syncStatus` — a stale remote thumbnail must not
   * report the document itself as broken.
   */
  async function updateSyncFailureMeta(job: OutboxJob, message: string): Promise<void> {
    const store = deps.getStore()
    const latest = await store.getMeta(job.canvasId)
    if (!latest) return
    if (job.type === 'putThumb') {
      await store.updateMeta(job.canvasId, { lastSyncError: message })
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

  async function putMetadata(
    adapter: StorageAdapter,
    store: LocalCanvasStore,
    meta: LocalCanvasMeta,
    job: OutboxJob
  ): Promise<void> {
    // Write whatever the row currently says rather than bailing when the revision
    // advanced past the job — the job is "sync this canvas", not "sync revision N".
    const revision = meta.revision
    const metadata = documentMetadata(meta)
    if (adapter.putDocumentMetadata) {
      await adapter.putDocumentMetadata(job.canvasId, metadata)
    } else {
      const bytes = meta.hasFig ? await store.readFig(job.canvasId) : null
      if (!bytes) throw new Error('Storage provider cannot update document metadata separately')
      // This path uploads the body alongside the metadata.
      await adapter.putDocument(job.canvasId, bytes, metadata)
      await markRevisionSynced(store, job.canvasId, revision, { bodyUploaded: true })
      return
    }
    await markRevisionSynced(store, job.canvasId, revision)

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
        revision: latest.revision
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
    setUploadProgress(job.canvasId, 0)
    try {
      await adapter.putDocument(job.canvasId, bytes, documentMetadata(meta), (progress) => {
        if (progress.totalBytes) {
          setUploadProgress(job.canvasId, progress.transferredBytes / progress.totalBytes)
        }
      })
    } finally {
      setUploadProgress(job.canvasId, null)
    }
    if (await markRevisionSynced(store, job.canvasId, revision, { bodyUploaded: true })) {
      await evictLocalFigCache(new Set([job.canvasId]))
    }
  }

  async function runJob(job: OutboxJob): Promise<void> {
    const store = deps.getStore()
    const meta = await store.getMeta(job.canvasId)
    const adapter = await deps.resolveTarget(meta?.providerId ?? null)

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
  }

  async function pumpOnce(): Promise<void> {
    const outbox = deps.getOutbox()
    const jobs = await outbox.list()
    setPendingSyncCount(jobs.length)

    if (jobs.length === 0) {
      if (deps.isOnline()) setSyncUi('idle')
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
      setSyncUi('blocked', await describeBlockedQueue(jobs))
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
      if (remaining.length === 0) setSyncUi('idle')
      else scheduleWake(50)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (error instanceof StorageSyncBlockedError) {
        await outbox.update({
          ...job,
          nextAttemptAt: Number.MAX_SAFE_INTEGER
        })
        // Record it on the document too — this branch used to leave no per-document
        // trace at all, so nothing could explain the pause afterwards.
        await updateSyncFailureMeta(job, message)
        setSyncUi('blocked', message)
        return
      }

      const attempts = job.attempts + 1
      const permanent = isPermanentError(error) || attempts >= MAX_ATTEMPTS
      console.warn('[Storage sync] job failed:', job.type, job.canvasId, message)

      if (permanent) {
        await updateSyncFailureMeta(job, message)
        if (job.type !== 'putThumb') {
          // Terminal for this job: it parks below and only resume() revives it.
          setSyncUi('blocked', message)
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
      // Transient: still retrying, so surface it as `error` rather than `blocked`.
      setSyncUi('error', message)
      if (job.type !== 'putThumb') {
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
    await deps.getOutbox().enqueue({ canvasId, type, revision })
    void kick()
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
    void kick()
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

/**
 * Resolve the adapter for a captured target.
 *
 * Collapses the three module-singleton reads the engine used to perform inline
 * — `storagePreferencesComplete`, `storageCredentialStatuses` and
 * `createActiveStorageAdapter` — into the one injectable seam. `null` still
 * falls back to the active provider; jobs do not carry a target id yet.
 */
async function resolveConfiguredTarget(
  targetId: StorageProviderID | null
): Promise<StorageAdapter> {
  const providerID = targetId ?? activeStorageProviderID.value
  if (!storagePreferencesComplete(providerID)) {
    throw new StorageSyncBlockedError('Storage is not configured')
  }
  const provider = storageProviderRegistry.get(providerID)
  const statuses = await storageCredentialStatuses(providerID)
  const missingCredential = provider.credentialFields.some(
    (field) => field.required && statuses[field.id] !== 'configured'
  )
  if (missingCredential) {
    throw new StorageSyncBlockedError('Storage credentials are unavailable')
  }
  return createActiveStorageAdapter(providerID)
}

/**
 * Hold a cross-tab exclusive lock for the duration of a drain.
 *
 * The outbox is shared IndexedDB but the in-tab `pumping` flag is per-realm, so
 * two open tabs would both select the same job and upload the same bytes. The
 * loser then found the blob evicted by the winner, failed, and demoted a healthy
 * document to `error`. `ifAvailable` means a tab that loses the lock simply
 * skips this drain rather than queueing another full pass behind it.
 */
async function runWithWebLock(key: string, run: () => Promise<void>): Promise<void> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (!locks) return run()
  await locks.request(key, { ifAvailable: true }, async (lock) => {
    if (!lock) return
    await run()
  })
}

export const syncEngine = createSyncEngine({
  getStore: getLocalCanvasStore,
  getOutbox,
  resolveTarget: resolveConfiguredTarget,
  isOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine),
  subscribeConnectivity: (handlers) => {
    if (!IS_BROWSER) return () => {}
    const online = () => handlers.online()
    const offline = () => handlers.offline()
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  },
  schedule: (ms, run) => {
    const timer = setTimeout(run, ms)
    return () => clearTimeout(timer)
  },
  now: () => Date.now(),
  random: () => (crypto.getRandomValues(new Uint8Array(1))[0] ?? 0) / 256,
  runExclusive: runWithWebLock
})

export const kickSyncEngine = (): Promise<void> => syncEngine.kick()
export const enqueuePutCanvas = (canvasId: string, revision: number): Promise<void> =>
  syncEngine.enqueuePutCanvas(canvasId, revision)
export const enqueuePutMetadata = (canvasId: string, revision: number): Promise<void> =>
  syncEngine.enqueuePutMetadata(canvasId, revision)
export const enqueuePutThumb = (canvasId: string, revision: number): Promise<void> =>
  syncEngine.enqueuePutThumb(canvasId, revision)
export const enqueueDeleteCanvas = (canvasId: string): Promise<void> =>
  syncEngine.enqueueDeleteCanvas(canvasId)
export const resumeStorageSync = (): Promise<void> => syncEngine.resume()
export const clearStorageLocalMirror = (): Promise<void> => syncEngine.clearLocalMirror()
