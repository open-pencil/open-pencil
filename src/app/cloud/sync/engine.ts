import { IS_BROWSER } from '@open-pencil/core/constants'

import { getActiveCloudAdapter } from '@/app/cloud/active'
import { getLocalCanvasStore } from '@/app/cloud/local-store'
import { getOutbox } from '@/app/cloud/sync/outbox'
import { setUploadProgress } from '@/app/cloud/sync/progress'
import { setPendingSyncCount, setSyncUi } from '@/app/cloud/sync/status'
import type { OutboxJob } from '@/app/cloud/sync/types'

const MAX_ATTEMPTS = 8
const BASE_BACKOFF_MS = 1500
const MAX_BACKOFF_MS = 60_000

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

async function runJob(job: OutboxJob): Promise<void> {
  const adapter = getActiveCloudAdapter()
  if (!adapter) throw new Error('Cloud storage is not configured')
  const store = getLocalCanvasStore()
  const meta = await store.getMeta(job.canvasId)

  if (job.type === 'deleteCanvas') {
    await adapter.deleteCanvas(job.canvasId)
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

  if (job.type === 'putCanvas') {
    // Superseded by a newer local revision already on disk
    if (meta.revision > job.revision) return
    if (!meta.hasFig) return
    const fig = await store.readFig(job.canvasId)
    if (!fig || fig.byteLength === 0) throw new Error('Local document missing for sync')
    setUploadProgress(job.canvasId, 0)
    try {
      await adapter.putCanvas(
        job.canvasId,
        fig,
        {
          name: meta.name,
          updatedAt: meta.updatedAt
        },
        ({ sentBytes, totalBytes }) => {
          if (totalBytes) setUploadProgress(job.canvasId, sentBytes / totalBytes)
        }
      )
    } finally {
      setUploadProgress(job.canvasId, null)
    }
    // Only mark synced if still on this revision and no other pending work for newer rev
    const latest = await store.getMeta(job.canvasId)
    if (latest && latest.revision === job.revision && !latest.tombstoned) {
      await store.updateMeta(job.canvasId, {
        syncStatus: 'synced',
        lastSyncedAt: new Date().toISOString(),
        lastSyncError: null
      })
    }
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

  setSyncUi('syncing')
  const now = Date.now()
  // Single-flight globally for simplicity (large figs)
  const job = jobs.find((j) => j.nextAttemptAt <= now)
  if (!job) {
    const nextAt = Math.min(...jobs.map((j) => j.nextAttemptAt))
    scheduleWake(Math.max(250, nextAt - now))
    return
  }

  try {
    await runJob(job)
    await outbox.remove(job.id)
    const remaining = await outbox.list()
    setPendingSyncCount(remaining.length)
    if (remaining.length === 0) setSyncUi('idle')
    else scheduleWake(50)
  } catch (error) {
    const attempts = job.attempts + 1
    const permanent = isPermanentError(error) || attempts >= MAX_ATTEMPTS
    const message = error instanceof Error ? error.message : String(error)
    console.warn('[Cloud sync] job failed:', job.type, job.canvasId, message)

    if (permanent) {
      // A failed thumbnail upload must not poison the document's sync status —
      // only canvas/delete jobs reflect into the meta row.
      if (job.type !== 'putThumb') {
        await getLocalCanvasStore().updateMeta(job.canvasId, {
          syncStatus: 'error',
          lastSyncError: message
        })
        setSyncUi('error', message.slice(0, 120))
      } else {
        // Keep a record without touching syncStatus so the stale remote
        // thumbnail is at least diagnosable.
        await getLocalCanvasStore().updateMeta(job.canvasId, { lastSyncError: message })
      }
      await outbox.remove(job.id)
      const remaining = await outbox.list()
      setPendingSyncCount(remaining.length)
      if (remaining.length > 0) scheduleWake(1000)
      else if (job.type === 'putThumb') setSyncUi('idle')
      return
    }

    const updated: OutboxJob = {
      ...job,
      attempts,
      nextAttemptAt: Date.now() + backoffMs(attempts)
    }
    await outbox.update(updated)
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

/** Start or continue draining the outbox. Safe to call often. */
export async function kickSyncEngine(): Promise<void> {
  ensureOnlineListeners()
  if (pumping) return
  pumping = true
  let pumpFailed = false
  try {
    // Drain a few jobs per kick to avoid long tight loops blocking the tab.
    for (let i = 0; i < 3; i++) {
      const before = (await getOutbox().list()).length
      await pumpOnce()
      const after = (await getOutbox().list()).length
      if (after === 0 || after >= before) break
    }
  } catch (error) {
    // Never let an escaped rejection strand the queue — retry shortly.
    pumpFailed = true
    console.warn('[Cloud sync] pump failed:', error)
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

export async function enqueuePutThumb(canvasId: string, revision: number): Promise<void> {
  await getOutbox().enqueue({ canvasId, type: 'putThumb', revision })
  void kickSyncEngine()
}

export async function enqueueDeleteCanvas(canvasId: string): Promise<void> {
  await getOutbox().enqueue({ canvasId, type: 'deleteCanvas', revision: 0 })
  void kickSyncEngine()
}

/** After credentials cleared — drop local mirror + outbox (optional safety). */
export async function clearCloudLocalMirror(): Promise<void> {
  await getLocalCanvasStore().clearAll()
  await getOutbox().clear()
  setPendingSyncCount(0)
  setSyncUi('idle')
}
