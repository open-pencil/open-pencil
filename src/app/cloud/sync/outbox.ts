import {
  makeJobId,
  supersedePutCanvasJobs,
  type OutboxJob,
  type OutboxJobType
} from '@/app/cloud/sync/types'

const DB_NAME = 'open-pencil-cloud-outbox'
const DB_VERSION = 1
const STORE = 'jobs'

export type Outbox = {
  list(): Promise<OutboxJob[]>
  enqueue(job: Omit<OutboxJob, 'id' | 'createdAt' | 'attempts' | 'nextAttemptAt'> & {
    id?: string
    attempts?: number
    nextAttemptAt?: number
  }): Promise<OutboxJob>
  update(job: OutboxJob): Promise<void>
  remove(id: string): Promise<void>
  clear(): Promise<void>
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('Failed to open outbox DB'))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
  })
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
}

export function createMemoryOutbox(): Outbox {
  let jobs: OutboxJob[] = []

  return {
    async list() {
      return [...jobs].sort((a, b) => a.createdAt - b.createdAt)
    },
    async enqueue(partial) {
      const job: OutboxJob = {
        id: partial.id ?? makeJobId(),
        canvasId: partial.canvasId,
        type: partial.type,
        revision: partial.revision,
        createdAt: Date.now(),
        attempts: partial.attempts ?? 0,
        nextAttemptAt: partial.nextAttemptAt ?? Date.now()
      }
      if (job.type === 'putCanvas') {
        jobs = supersedePutCanvasJobs(jobs, job.canvasId, job.revision)
      }
      // One pending putThumb / delete per canvas — keep latest only for same type
      jobs = jobs.filter((j) => !(j.canvasId === job.canvasId && j.type === job.type && j.type !== 'putCanvas'))
      jobs.push(job)
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
      const job: OutboxJob = {
        id: partial.id ?? makeJobId(),
        canvasId: partial.canvasId,
        type: partial.type as OutboxJobType,
        revision: partial.revision,
        createdAt: Date.now(),
        attempts: partial.attempts ?? 0,
        nextAttemptAt: partial.nextAttemptAt ?? Date.now()
      }
      const existing = await this.list()
      let next = existing
      if (job.type === 'putCanvas') {
        next = supersedePutCanvasJobs(next, job.canvasId, job.revision)
      }
      next = next.filter(
        (j) => !(j.canvasId === job.canvasId && j.type === job.type && j.type !== 'putCanvas')
      )
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
