import { openIdb, reqToPromise, txDone } from '@/app/cloud/idb-util'
import { makeJobId, supersedePutCanvasJobs, type OutboxJob } from '@/app/cloud/sync/types'

const DB_NAME = 'open-pencil-cloud-outbox'
const DB_VERSION = 1
const STORE = 'jobs'

export type OutboxEnqueueInput = Omit<
  OutboxJob,
  'id' | 'createdAt' | 'attempts' | 'nextAttemptAt'
> & {
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
    createdAt: Date.now(),
    attempts: partial.attempts ?? 0,
    nextAttemptAt: partial.nextAttemptAt ?? Date.now()
  }
}

/**
 * Queue with the new job applied: putCanvas supersedes older revisions,
 * and only one putThumb/delete per canvas survives (latest wins).
 */
function withJobQueued(queue: OutboxJob[], job: OutboxJob): OutboxJob[] {
  let next = queue
  if (job.type === 'putCanvas') {
    next = supersedePutCanvasJobs(next, job.canvasId, job.revision)
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
    if (!dbPromise) dbPromise = openDb()
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
      const existing = await this.list()
      const next = withJobQueued(existing, job)
      const removeIds = existing.filter((j) => !next.some((n) => n.id === j.id)).map((j) => j.id)

      const database = await db()
      const tx = database.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      for (const id of removeIds) store.delete(id)
      store.put(job)
      await txDone(tx)
      return job
    },

    async update(job) {
      const database = await db()
      const tx = database.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(job)
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
    console.warn('[Cloud] Outbox IDB unavailable, using memory:', error)
  }
  outboxSingleton = createMemoryOutbox()
  return outboxSingleton
}
