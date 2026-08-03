import { openIdb, reqToPromise, txDone } from '@/app/storage/idb-util'
import { makeJobId, supersedePutCanvasJobs, type OutboxJob } from '@/app/storage/sync/types'
import type { StorageTargetID } from '@/app/storage/target'

const DB_NAME = 'open-pencil-cloud-outbox'
const DB_VERSION = 1
const STORE = 'jobs'

export type OutboxEnqueueInput = Omit<
  OutboxJob,
  'id' | 'createdAt' | 'attempts' | 'nextAttemptAt' | 'targetId'
> & {
  targetId?: StorageTargetID | null
  id?: string
  attempts?: number
  nextAttemptAt?: number
}

export type Outbox = {
  list(): Promise<OutboxJob[]>
  enqueue(job: OutboxEnqueueInput): Promise<OutboxJob>
  update(job: OutboxJob): Promise<void>
  remove(id: string): Promise<void>
  clear(): Promise<void>
}

function openDb(): Promise<IDBDatabase> {
  return openIdb(DB_NAME, DB_VERSION, (db) => {
    if (!db.objectStoreNames.contains(STORE)) {
      db.createObjectStore(STORE, { keyPath: 'id' })
    }
  })
}

function buildJob(partial: OutboxEnqueueInput): OutboxJob {
  return {
    id: partial.id ?? makeJobId(),
    canvasId: partial.canvasId,
    type: partial.type,
    revision: partial.revision,
    targetId: partial.targetId ?? null,
    createdAt: Date.now(),
    attempts: partial.attempts ?? 0,
    nextAttemptAt: partial.nextAttemptAt ?? Date.now()
  }
}

/**
 * Queue with the new job applied: putCanvas supersedes older revisions,
 * and only one metadata/thumbnail/delete job per canvas survives (latest wins).
 */
function withJobQueued(queue: OutboxJob[], job: OutboxJob): OutboxJob[] {
  let next = queue
  if (job.type === 'putCanvas') {
    next = supersedePutCanvasJobs(next, job.canvasId, job.revision)
    next = next.filter(
      (queued) =>
        queued.canvasId !== job.canvasId ||
        queued.type !== 'putMetadata' ||
        queued.revision > job.revision
    )
  }
  next = next.filter(
    (j) => !(j.canvasId === job.canvasId && j.type === job.type && j.type !== 'putCanvas')
  )
  return [...next, job]
}

export function createMemoryOutbox(): Outbox {
  let jobs: OutboxJob[] = []

  return {
    async list() {
      return [...jobs].sort((a, b) => a.createdAt - b.createdAt)
    },
    async enqueue(partial) {
      const job = buildJob(partial)
      jobs = withJobQueued(jobs, job)
      return job
    },
    async update(job) {
      jobs = jobs.map((j) => (j.id === job.id ? job : j))
    },
    async remove(id) {
      jobs = jobs.filter((j) => j.id !== id)
    },
    async clear() {
      jobs = []
    }
  }
}

export function createIdbOutbox(): Outbox {
  let dbPromise: Promise<IDBDatabase> | null = null
  function db() {
    // Never memoize a rejection: one transient open failure (quota, private
    // mode, a blocked upgrade from another tab) used to brick the outbox for
    // the tab's whole lifetime, so every later save failed to queue.
    if (!dbPromise) {
      dbPromise = openDb().catch((error: unknown) => {
        dbPromise = null
        throw error
      })
    }
    return dbPromise
  }

  return {
    async list() {
      const database = await db()
      const tx = database.transaction(STORE, 'readonly')
      const all = (await reqToPromise(tx.objectStore(STORE).getAll())) as OutboxJob[]
      await txDone(tx)
      return all.sort((a, b) => a.createdAt - b.createdAt)
    },

    async enqueue(partial) {
      const job = buildJob(partial)
      // Read and write in ONE transaction so concurrent enqueues can't compute
      // supersession from the same stale snapshot (duplicate/stale jobs).
      const database = await db()
      const tx = database.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const existing = (await reqToPromise(store.getAll())) as OutboxJob[]
      const next = withJobQueued(existing, job)
      for (const j of existing) {
        if (!next.some((n) => n.id === j.id)) store.delete(j.id)
      }
      store.put(job)
      await txDone(tx)
      return job
    },

    async update(job) {
      const database = await db()
      const tx = database.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      // `put` is an upsert, so a retry/backoff write for a job that was already
      // completed or superseded used to RESURRECT it. The zombie then re-ran,
      // failed on missing local bytes, and demoted a healthy document to
      // `error`. Only update a row that still exists.
      const existing = (await reqToPromise(store.get(job.id))) as OutboxJob | undefined
      if (existing) store.put(job)
      await txDone(tx)
    },

    async remove(id) {
      const database = await db()
      const tx = database.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(id)
      await txDone(tx)
    },

    async clear() {
      const database = await db()
      const tx = database.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).clear()
      await txDone(tx)
    }
  }
}

let outboxSingleton: Outbox | null = null

export function resetOutboxForTests(outbox?: Outbox) {
  outboxSingleton = outbox ?? null
}

export function getOutbox(): Outbox {
  if (outboxSingleton) return outboxSingleton
  try {
    if (typeof indexedDB !== 'undefined') {
      outboxSingleton = createIdbOutbox()
      return outboxSingleton
    }
  } catch (error) {
    console.warn('[Storage] Outbox IDB unavailable, using memory:', error)
  }
  outboxSingleton = createMemoryOutbox()
  return outboxSingleton
}
