import { IS_BROWSER } from '@open-pencil/core/constants'

import {
  activeStorageProviderID,
  createActiveStorageAdapter,
  storageCredentialStatuses,
  storagePreferencesComplete,
  storageProviderRegistry,
  type StorageAdapter,
  type StorageDocumentMetadata
} from '@/app/integrations/storage'
import { evictLocalFigCache } from '@/app/storage/cache-eviction'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import type { LocalCanvasMeta } from '@/app/storage/local-store/types'
import { getOutbox } from '@/app/storage/sync/outbox'
import { setUploadProgress } from '@/app/storage/sync/progress'
import { setPendingSyncCount, setSyncUi } from '@/app/storage/sync/status'
import type { OutboxJob } from '@/app/storage/sync/types'

const MAX_ATTEMPTS = 8
const BASE_BACKOFF_MS = 1500
const MAX_BACKOFF_MS = 60_000

class StorageSyncBlockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageSyncBlockedError'
  }
}

let pumping = false
let wakeTimer: ReturnType<typeof setTimeout> | null = null
let onlineBound = false

function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

function backoffMs(attempts: number): number {
  const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1))
  const jitter = Math.floor(exp * 0.2 * ((crypto.getRandomValues(new Uint8Array(1))[0] ?? 0) / 255))
  return exp + jitter
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

/**
 * Record a sync failure against the document, guarded by revision.
 *
 * Unguarded writes let a stale or zombie job demote a document that is healthy
 * at a newer revision to `error`, leaving a permanent false failure badge.
 * `putThumb` never touches `syncStatus` — a stale remote thumbnail must not
 * report the document itself as broken.
 */
async function updateSyncFailureMeta(job: OutboxJob, message: string): Promise<void> {
  const store = getLocalCanvasStore()
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
  const store = getLocalCanvasStore()
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
 * A document only counts as `synced` when its BYTES are on the remote at the
 * current revision. Metadata-only puts must not claim it: renaming a document
 * with a pending body upload used to mark the row synced, which both hid the
 * missing upload and made the local blob evictable — destroying the only copy.
 */
export async function markRevisionSynced(
  store: LocalCanvasStore,
  canvasId: string,
  revision: number,
  options: { bodyUploaded?: boolean } = {}
): Promise<boolean> {
  const latest = await store.getMeta(canvasId)
  if (!latest || latest.revision !== revision || latest.tombstoned) return false
  const bodySyncedRevision = options.bodyUploaded ? revision : latest.bodySyncedRevision
  const bodyIsCurrent = bodySyncedRevision === revision
  await store.updateMeta(
    canvasId,
    {
      syncStatus: bodyIsCurrent ? 'synced' : 'pending',
      bodySyncedRevision,
      lastSyncedAt: new Date().toISOString(),
      lastSyncError: null
    },
    { expectedRevision: revision }
  )
  return bodyIsCurrent
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

  // A sidecar write proves nothing about the body. If this revision's bytes are
  // still missing remotely, queue the upload instead of leaving a row that looks
  // synced but has no remote object behind it.
  const latest = await store.getMeta(job.canvasId)
  if (
    latest &&
    !latest.tombstoned &&
    latest.hasFig &&
    latest.bodySyncedRevision !== latest.revision
  ) {
    await getOutbox().enqueue({
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
  const store = getLocalCanvasStore()
  const meta = await store.getMeta(job.canvasId)
  const providerID = meta?.providerId ?? activeStorageProviderID.value
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
  const adapter = createActiveStorageAdapter(providerID)

  if (job.type === 'deleteCanvas') {
    await adapter.deleteDocument(job.canvasId)
    // Keep the tombstoned row: reconcile purges it once the remote listing
    // confirms the object is gone. Removing it here opened a race where a
    // concurrent reconcile re-seeded the canvas from a stale remote listing.
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
  const outbox = getOutbox()
  const jobs = await outbox.list()
  setPendingSyncCount(jobs.length)

  if (jobs.length === 0) {
    if (isOnline()) setSyncUi('idle')
    return
  }

  if (!isOnline()) {
    setSyncUi('offline')
    scheduleWake(5000)
    return
  }

  const now = Date.now()
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
        // Terminal for this job: it parks below and only resumeStorageSync revives it.
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
      nextAttemptAt: Date.now() + backoffMs(attempts)
    }
    await outbox.update(updated)
    // Transient: still retrying, so surface it as `error` rather than `blocked`.
    setSyncUi('error', message)
    if (job.type !== 'putThumb') {
      await getLocalCanvasStore().updateMeta(job.canvasId, {
        syncStatus: 'pending',
        lastSyncError: message
      })
    }
    // Wake for the next ready job across the whole queue — not this job's
    // full backoff, which starved other jobs that were ready sooner.
    const all = await outbox.list()
    const nextAt = Math.min(...all.map((j) => j.nextAttemptAt))
    scheduleWake(Math.max(250, nextAt - Date.now()))
  }
}

function scheduleWake(ms: number) {
  if (wakeTimer != null) clearTimeout(wakeTimer)
  wakeTimer = setTimeout(() => {
    wakeTimer = null
    void kickSyncEngine()
  }, ms)
}

function ensureOnlineListeners() {
  if (onlineBound || !IS_BROWSER) return
  onlineBound = true
  window.addEventListener('online', () => {
    setSyncUi('syncing')
    void kickSyncEngine()
  })
  window.addEventListener('offline', () => {
    setSyncUi('offline')
  })
}

const SYNC_LOCK = 'openpencil-storage-sync'

/**
 * Hold a cross-tab exclusive lock for the duration of a drain.
 *
 * The outbox is shared IndexedDB but the in-tab `pumping` flag is per-realm, so
 * two open tabs would both select the same job and upload the same bytes. The
 * loser then found the blob evicted by the winner, failed, and demoted a healthy
 * document to `error`. `ifAvailable` means a tab that loses the lock simply
 * skips this drain rather than queueing another full pass behind it.
 */
async function withSyncLock(run: () => Promise<void>): Promise<void> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (!locks) return run()
  await locks.request(SYNC_LOCK, { ifAvailable: true }, async (lock) => {
    if (!lock) return
    await run()
  })
}

/** Start or continue draining the outbox. Safe to call often. */
export async function kickSyncEngine(): Promise<void> {
  ensureOnlineListeners()
  if (pumping) return
  pumping = true
  let pumpFailed = false
  try {
    await withSyncLock(async () => {
      // Drain a few jobs per kick to avoid long tight loops blocking the tab.
      for (let i = 0; i < 3; i++) {
        const before = (await getOutbox().list()).length
        await pumpOnce()
        const after = (await getOutbox().list()).length
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
  if (pumpFailed || !isOnline()) return
  const jobs = await getOutbox().list()
  if (jobs.some((job) => job.nextAttemptAt <= Date.now())) scheduleWake(250)
}

export async function enqueuePutCanvas(canvasId: string, revision: number): Promise<void> {
  await getOutbox().enqueue({ canvasId, type: 'putCanvas', revision })
  void kickSyncEngine()
}

export async function enqueuePutMetadata(canvasId: string, revision: number): Promise<void> {
  await getOutbox().enqueue({ canvasId, type: 'putMetadata', revision })
  void kickSyncEngine()
}

export async function enqueuePutThumb(canvasId: string, revision: number): Promise<void> {
  await getOutbox().enqueue({ canvasId, type: 'putThumb', revision })
  void kickSyncEngine()
}

export async function enqueueDeleteCanvas(canvasId: string): Promise<void> {
  await getOutbox().enqueue({ canvasId, type: 'deleteCanvas', revision: 0 })
  void kickSyncEngine()
}

/** Retry durable work immediately after storage settings or credentials change. */
export async function resumeStorageSync(): Promise<void> {
  const outbox = getOutbox()
  const jobs = await outbox.list()
  const now = Date.now()
  // Reset attempts too: the user repairing credentials is exactly the signal
  // that the old attempt count is stale. Without this a parked job got a single
  // retry and re-parked on the first transient blip.
  await Promise.all(jobs.map((job) => outbox.update({ ...job, attempts: 0, nextAttemptAt: now })))
  if (jobs.length > 0) setSyncUi('syncing')
  void kickSyncEngine()
}

/** After credentials cleared — drop local mirror + outbox (optional safety). */
export async function clearStorageLocalMirror(): Promise<void> {
  await getLocalCanvasStore().clearAll()
  await getOutbox().clear()
  setPendingSyncCount(0)
  setSyncUi('idle')
}
