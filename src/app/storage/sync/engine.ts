import {
  describeDiagnosticError,
  recordStorageFailure,
  storageOperationForJob
} from '@/app/diagnostics'
import { StorageConflictError } from '@/app/integrations/storage/conflict'
import type { StorageAdapter, StorageProviderID } from '@/app/integrations/storage/types'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import {
  commitCanvas,
  commitMetadata,
  deleteCanvas,
  rebaseOnDestination,
  type CommitContext
} from '@/app/storage/sync/commit'
import type { Outbox } from '@/app/storage/sync/outbox'
import { setUploadProgress } from '@/app/storage/sync/progress'
import { setPendingSyncCount, setSyncUI } from '@/app/storage/sync/status'
import type { OutboxJob, OutboxJobType } from '@/app/storage/sync/types'
import {
  emitStorageWorkspaceEvent,
  type StorageWorkspaceEvent
} from '@/app/storage/workspace/events'

const MAX_ATTEMPTS = 8
const BASE_BACKOFF_MS = 1500
const MAX_BACKOFF_MS = 60_000
const PARKED = Number.MAX_SAFE_INTEGER
const SYNC_LOCK = 'openpencil-storage-sync'
/** Remote commits of one design are at least this far apart while it is being edited. */
export const COMMIT_SPACING_MS = 30_000
/** Even a flush keeps commits to one design this far apart; B2 may reorder closer writes. */
export const MIN_COMMIT_GAP_MS = 1500

export class StorageSyncBlockedError extends Error {
  constructor(
    message: string,
    readonly reason: 'unconfigured' | 'credentials'
  ) {
    super(message)
    this.name = 'StorageSyncBlockedError'
  }
}

export type CancelScheduled = () => void

export type ConnectivityHandlers = {
  online(): void
  offline(): void
  /** The page is going away or out of sight: commit what is waiting now. */
  hidden(): void
}

/** Everything the engine reaches outside itself, so timers and storage are injectable. */
export type SyncEngineDependencies = {
  getStore: () => LocalCanvasStore
  getOutbox: () => Outbox
  activeProviderId: () => StorageProviderID
  /** The adapter for a provider; throws `StorageSyncBlockedError` while it cannot be used. */
  resolveAdapter: (providerId: StorageProviderID) => Promise<StorageAdapter>
  destinationOf: (providerId: StorageProviderID) => string | null
  isOnline: () => boolean
  subscribeConnectivity: (handlers: ConnectivityHandlers) => () => void
  schedule: (ms: number, run: () => void) => CancelScheduled
  now: () => number
  /** Jitter source in [0, 1). */
  random: () => number
  runExclusive: (key: string, run: () => Promise<void>) => Promise<void>
  emit?: (event: StorageWorkspaceEvent) => void
  /** Best-effort sweep once the queue is empty; the caller decides how often it may run. */
  collectGarbage?: () => Promise<void>
}

export type EnqueueOptions = { revision: number }

export type SyncEngine = {
  pumpOnce(): Promise<void>
  kick(): Promise<void>
  /** Resolves when no pump is running, so a caller can await the work, not just the queueing. */
  idle(): Promise<void>
  resume(): Promise<void>
  /** Commit waiting work for one design (or all) now rather than after the commit spacing. */
  flush(canvasId?: string): Promise<void>
  clearLocalMirror(): Promise<void>
  enqueue(canvasId: string, type: OutboxJobType, revision: number): Promise<void>
  dispose(): void
}

export function nextSyncWakeDelay(jobs: OutboxJob[], now = Date.now()): number | null {
  if (jobs.length === 0) return null
  const nextAt = Math.min(...jobs.map((job) => job.nextAttemptAt))
  return nextAt === PARKED ? null : Math.max(250, nextAt - now)
}

function isPermanentError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes('403') ||
    msg.includes('401') ||
    msg.includes('access denied') ||
    msg.includes('invalid access key') ||
    msg.includes('not configured')
  )
}

function isCommit(type: OutboxJobType): boolean {
  return type === 'putCanvas' || type === 'putMetadata'
}

export function createSyncEngine(deps: SyncEngineDependencies): SyncEngine {
  const emit = deps.emit ?? emitStorageWorkspaceEvent
  /** When each design last committed, for the per-design commit spacing. */
  const lastCommitAt = new Map<string, number>()
  let pumping = false
  let inFlight: Promise<void> | null = null
  let cancelWake: CancelScheduled | null = null
  let unsubscribeConnectivity: (() => void) | null = null
  let disposed = false
  let garbageCollected = false

  function startPump(): void {
    if (pumping) return
    const running = kick()
    inFlight = running
    void running.finally(() => {
      if (inFlight === running) inFlight = null
    })
  }

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
        setSyncUI('syncing')
        startPump()
      },
      offline: () => setSyncUI('offline'),
      hidden: () => void flush()
    })
  }

  /** The earliest a commit of this design may run: spaced from its last commit. */
  function commitDueAt(canvasId: string, spacing: number): number {
    const last = lastCommitAt.get(canvasId)
    return last === undefined ? deps.now() : Math.max(deps.now(), last + spacing)
  }

  async function runJob(job: OutboxJob): Promise<void> {
    const store = deps.getStore()
    const stored = await store.getMeta(job.canvasId)
    const providerId = stored?.providerId ?? deps.activeProviderId()
    const adapter = await deps.resolveAdapter(providerId)
    const destination = deps.destinationOf(providerId)
    const meta = stored ? await rebaseOnDestination(store, stored, destination) : null
    const context: CommitContext = {
      adapter,
      store,
      job,
      destination,
      onProgress: (fraction) => setUploadProgress(job.canvasId, fraction)
    }

    if (job.type === 'deleteCanvas') {
      if ((await deleteCanvas(context, meta)) === 'kept') {
        emit({ providerId, documentId: job.canvasId, kind: 'changed' })
      }
      return
    }
    if (!meta || meta.tombstoned) return

    if (job.type === 'putThumb') {
      const thumb = adapter.putThumbnail ? await store.readThumb(job.canvasId) : null
      if (thumb) await adapter.putThumbnail?.(job.canvasId, thumb)
      return
    }
    if (job.type === 'putCanvas') await commitCanvas(context, meta)
    else await commitMetadata(context, meta)
    lastCommitAt.set(job.canvasId, deps.now())
    emit({ providerId, documentId: job.canvasId, kind: 'synced' })
  }

  /** The design changed on another device too: park its work and let the library keep both. */
  async function parkConflict(job: OutboxJob, message: string): Promise<void> {
    const outbox = deps.getOutbox()
    const store = deps.getStore()
    await outbox.update({ ...job, nextAttemptAt: PARKED })
    const latest = await store.getMeta(job.canvasId)
    if (latest) {
      await store.updateMeta(
        job.canvasId,
        { syncStatus: 'conflict', lastSyncError: null },
        { expectedRevision: latest.revision }
      )
    }
    setSyncUI('conflict', message)
    emit({
      providerId: latest?.providerId ?? deps.activeProviderId(),
      documentId: job.canvasId,
      kind: 'conflict'
    })
  }

  async function handleFailure(job: OutboxJob, error: unknown): Promise<void> {
    const outbox = deps.getOutbox()
    const store = deps.getStore()
    const message = error instanceof Error ? error.message : String(error)
    if (error instanceof StorageConflictError) {
      await parkConflict(job, message)
      return
    }
    // Without storage set up, designs stay in the library on this device and their uploads wait
    // for it. That is the expected state, not a failure.
    const unconfigured = error instanceof StorageSyncBlockedError && error.reason === 'unconfigured'
    if (!unconfigured) {
      const { errorName, errorCode, retryable } = describeDiagnosticError(error)
      recordStorageFailure({
        operation: storageOperationForJob(job.type),
        errorName,
        errorCode,
        retryable
      })
    }
    if (error instanceof StorageSyncBlockedError) {
      await outbox.update({ ...job, nextAttemptAt: PARKED })
      if (unconfigured) setSyncUI('idle')
      else setSyncUI('error', message)
      return
    }

    const attempts = job.attempts + 1
    const permanent = isPermanentError(error) || attempts >= MAX_ATTEMPTS
    console.warn('[Storage sync] job failed:', job.type, job.canvasId, message)

    if (permanent) {
      if (job.type === 'putThumb') {
        // A thumbnail failure never marks the design itself as failing.
        await store.updateMeta(job.canvasId, { lastSyncError: message })
        await outbox.remove(job.id)
        const remaining = await outbox.list()
        setPendingSyncCount(remaining.length)
        if (remaining.length > 0) scheduleWake(1000)
        else setSyncUI('idle')
        return
      }
      await store.updateMeta(job.canvasId, { syncStatus: 'error', lastSyncError: message })
      setSyncUI('error', message.slice(0, 120))
      // Never discard a document mutation: it waits until settings are repaired and resumed.
      await outbox.update({ ...job, attempts, nextAttemptAt: PARKED })
      return
    }

    await outbox.update({ ...job, attempts, nextAttemptAt: deps.now() + backoffMs(attempts) })
    if (job.type !== 'putThumb') {
      await store.updateMeta(job.canvasId, { syncStatus: 'pending', lastSyncError: message })
    }
    // Wake for the next ready job across the whole queue, not this job's full backoff.
    const all = await outbox.list()
    const nextAt = Math.min(...all.map((queued) => queued.nextAttemptAt))
    scheduleWake(Math.max(250, nextAt - deps.now()))
  }

  function onEmptyQueue(): void {
    if (deps.isOnline()) setSyncUI('idle')
    if (garbageCollected || !deps.collectGarbage) return
    garbageCollected = true
    void deps.collectGarbage().catch((error: unknown) => {
      console.warn('[Storage sync] garbage collection failed:', error)
    })
  }

  async function pumpOnce(): Promise<void> {
    const outbox = deps.getOutbox()
    const jobs = await outbox.list()
    setPendingSyncCount(jobs.length)

    if (jobs.length === 0) {
      onEmptyQueue()
      return
    }

    if (!deps.isOnline()) {
      setSyncUI('offline')
      scheduleWake(5000)
      return
    }

    const now = deps.now()
    // Single-flight within this tab (large figs)
    const job = jobs.find((queued) => queued.nextAttemptAt <= now)
    if (!job) {
      // Waiting jobs keep the state they reported: a parked failure stays an error.
      const delay = nextSyncWakeDelay(jobs, now)
      if (delay != null) scheduleWake(delay)
      return
    }
    setSyncUI('syncing')

    try {
      await runJob(job)
      await outbox.remove(job.id)
      const remaining = await outbox.list()
      setPendingSyncCount(remaining.length)
      if (remaining.length === 0) onEmptyQueue()
      else scheduleWake(50)
    } catch (error) {
      await handleFailure(job, error)
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
    // A job enqueued mid-pump can slip past the loop's exit check while its kick was swallowed
    // by the pumping guard: re-wake if work is already due.
    if (pumpFailed || !deps.isOnline()) return
    const jobs = await deps.getOutbox().list()
    if (jobs.some((job) => job.nextAttemptAt <= deps.now())) scheduleWake(250)
  }

  /**
   * Queue work for a design. Commits of one design are spaced, so autosave's frequent local
   * writes become at most one remote commit per spacing interval; a design in conflict queues
   * its work parked until the conflict is resolved.
   */
  async function enqueue(canvasId: string, type: OutboxJobType, revision: number): Promise<void> {
    const meta = await deps.getStore().getMeta(canvasId)
    let nextAttemptAt = deps.now()
    if (meta?.syncStatus === 'conflict' && type !== 'deleteCanvas') nextAttemptAt = PARKED
    else if (isCommit(type)) nextAttemptAt = commitDueAt(canvasId, COMMIT_SPACING_MS)
    await deps.getOutbox().enqueue({ canvasId, type, revision, nextAttemptAt })
    startPump()
  }

  async function flush(canvasId?: string): Promise<void> {
    const outbox = deps.getOutbox()
    const jobs = await outbox.list()
    for (const job of jobs) {
      if (canvasId !== undefined && job.canvasId !== canvasId) continue
      if (job.nextAttemptAt === PARKED || job.nextAttemptAt <= deps.now()) continue
      const dueAt = isCommit(job.type) ? commitDueAt(job.canvasId, MIN_COMMIT_GAP_MS) : deps.now()
      if (dueAt < job.nextAttemptAt) await outbox.update({ ...job, nextAttemptAt: dueAt })
    }
    startPump()
  }

  /** Retry durable work immediately after storage settings or credentials change. */
  async function resume(): Promise<void> {
    const outbox = deps.getOutbox()
    const store = deps.getStore()
    const jobs = await outbox.list()
    const now = deps.now()
    for (const job of jobs) {
      // A design in conflict waits for its resolution, not for settings.
      if ((await store.getMeta(job.canvasId))?.syncStatus === 'conflict') continue
      await outbox.update({ ...job, attempts: 0, nextAttemptAt: now })
    }
    if (jobs.length > 0) setSyncUI('syncing')
    startPump()
  }

  async function clearLocalMirror(): Promise<void> {
    await deps.getStore().clearAll()
    await deps.getOutbox().clear()
    setPendingSyncCount(0)
    setSyncUI('idle')
  }

  return {
    pumpOnce,
    kick,
    idle,
    resume,
    flush,
    clearLocalMirror,
    enqueue,
    dispose: () => {
      disposed = true
      cancelWake?.()
      cancelWake = null
      unsubscribeConnectivity?.()
      unsubscribeConnectivity = null
    }
  }
}
