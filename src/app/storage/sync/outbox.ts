import type { DBSchema } from 'idb'

import { APP_DATABASE_NAMES, defineAppDatabase, openAppDatabase } from '@/app/storage/idb'
import { makeJobId, supersedePutCanvasJobs, type OutboxJob } from '@/app/storage/sync/types'

const STORE = 'jobs'

const outboxDatabase = defineAppDatabase<OutboxDatabase>({
  name: APP_DATABASE_NAMES.outbox,
  version: 1,
  callbacks: {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
  }
})

interface OutboxDatabase extends DBSchema {
  jobs: {
    key: string
    value: OutboxJob
  }
}

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

function openDatabase() {
  return openAppDatabase(outboxDatabase)
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
    (queued) =>
      !(queued.canvasId === job.canvasId && queued.type === job.type && queued.type !== 'putCanvas')
  )
  return [...next, job]
}

export function createMemoryOutbox(): Outbox {
  let jobs: OutboxJob[] = []

  return {
    async list() {
      return [...jobs].sort((left, right) => left.createdAt - right.createdAt)
    },
    async enqueue(partial) {
      const job = buildJob(partial)
      jobs = withJobQueued(jobs, job)
      return job
    },
    async update(job) {
      jobs = jobs.map((queued) => (queued.id === job.id ? job : queued))
    },
    async remove(id) {
      jobs = jobs.filter((job) => job.id !== id)
    },
    async clear() {
      jobs = []
    }
  }
}

export function createIdbOutbox(): Outbox {
  const database = openDatabase()

  return {
    async list() {
      const all = await (await database).getAll(STORE)
      return all.sort((left, right) => left.createdAt - right.createdAt)
    },

    async enqueue(partial) {
      const job = buildJob(partial)
      // Read and write in ONE transaction so concurrent enqueues can't compute
      // supersession from the same stale snapshot (duplicate/stale jobs).
      const transaction = (await database).transaction(STORE, 'readwrite')
      const store = transaction.objectStore(STORE)
      const existing = await store.getAll()
      const next = withJobQueued(existing, job)
      for (const queued of existing) {
        if (!next.some((candidate) => candidate.id === queued.id)) {
          await store.delete(queued.id)
        }
      }
      await store.put(job)
      await transaction.done
      return job
    },

    async update(job) {
      await (await database).put(STORE, job)
    },

    async remove(id) {
      await (await database).delete(STORE, id)
    },

    async clear() {
      await (await database).clear(STORE)
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
