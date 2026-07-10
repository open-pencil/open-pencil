import { getActiveCloudAdapter } from '@/app/cloud/active'
import { getLocalCanvasStore } from '@/app/cloud/local-store'
import { getOutbox } from '@/app/cloud/sync/outbox'
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
  return navigator.onLine !== false
}

function backoffMs(attempts: number): number {
  const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1))
  const jitter = Math.floor(exp * 0.2 * (crypto.getRandomValues(new Uint8Array(1))[0]! / 255))
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
    await store.remove(job.canvasId)
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
    await adapter.putCanvas(job.canvasId, fig, {
      name: meta.name,
      updatedAt: meta.updatedAt
    })
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

  if (job.type === 'putThumb') {
    if (!adapter.putThumbnail) return
    const thumb = await store.readThumb(job.canvasId)
    if (!thumb) return
    await adapter.putThumbnail(job.canvasId, thumb)
  }
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
  const ready = jobs.filter((j) => j.nextAttemptAt <= now)
  // Single-flight globally for simplicity (large figs)
  const job = ready[0]
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
      await getLocalCanvasStore().updateMeta(job.canvasId, {
        syncStatus: 'error',
        lastSyncError: message
      })
      await outbox.remove(job.id)
      setSyncUi('error', message.slice(0, 120))
      const remaining = await outbox.list()
      setPendingSyncCount(remaining.length)
      if (remaining.length > 0) scheduleWake(1000)
      return
    }

    const updated: OutboxJob = {
      ...job,
      attempts,
      nextAttemptAt: Date.now() + backoffMs(attempts)
    }
    await outbox.update(updated)
    await getLocalCanvasStore().updateMeta(job.canvasId, {
      syncStatus: 'pending',
      lastSyncError: message
    })
    scheduleWake(backoffMs(attempts))
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
  if (onlineBound || typeof window === 'undefined') return
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
  try {
    // Drain a few jobs per kick to avoid long tight loops blocking the tab.
    for (let i = 0; i < 3; i++) {
      const before = (await getOutbox().list()).length
      await pumpOnce()
      const after = (await getOutbox().list()).length
      if (after === 0 || after >= before) break
    }
  } finally {
    pumping = false
  }
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
