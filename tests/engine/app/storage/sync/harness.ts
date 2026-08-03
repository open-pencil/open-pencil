import type {
  StorageAdapter,
  StorageConnectionResult,
  StorageDocument,
  StorageDocumentMetadata,
  StorageUsage
} from '@/app/integrations/storage'
import { createMemoryLocalCanvasStore } from '@/app/storage/local-store/memory'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import {
  createSyncEngine,
  type CancelScheduled,
  type SyncEngine,
  type SyncEngineDependencies
} from '@/app/storage/sync/engine'
import { createMemoryOutbox } from '@/app/storage/sync/outbox'
import type { Outbox } from '@/app/storage/sync/outbox'

export type AdapterOp = 'put' | 'putMetadata' | 'putThumb' | 'delete' | 'get' | 'list'

export type RecordedCall = {
  op: AdapterOp
  id: string
  byteLength: number
}

export type RecordingAdapter = StorageAdapter & {
  readonly calls: RecordedCall[]
  /** Bytes last written per document — proves WHICH body reached the remote. */
  readonly bodies: Map<string, Uint8Array>
  count(op: AdapterOp): number
}

const OK: StorageConnectionResult = { ok: true, message: 'ok' }
const NO_USAGE: StorageUsage = { usedBytes: 0, documentCount: 0 }

/**
 * The budget instrument.
 *
 * Records every adapter call so a test can assert how MANY happened, not just
 * that the end state looks right. Every existing storage fake succeeds silently
 * and counts nothing, which is why a rename that re-uploaded a whole body read
 * as a pass.
 */
export function recordingAdapter(
  options: { supportsMetadataPut?: boolean } = {}
): RecordingAdapter {
  const calls: RecordedCall[] = []
  const bodies = new Map<string, Uint8Array>()

  const adapter: RecordingAdapter = {
    calls,
    bodies,
    count: (op) => calls.filter((call) => call.op === op).length,
    testConnection: async () => OK,
    listDocuments: async () => {
      calls.push({ op: 'list', id: '', byteLength: 0 })
      return [] as StorageDocument[]
    },
    getDocument: async (id) => {
      calls.push({ op: 'get', id, byteLength: 0 })
      return bodies.get(id) ?? new Uint8Array()
    },
    putDocument: async (id, bytes) => {
      calls.push({ op: 'put', id, byteLength: bytes.byteLength })
      bodies.set(id, bytes)
    },
    deleteDocument: async (id) => {
      calls.push({ op: 'delete', id, byteLength: 0 })
      bodies.delete(id)
    },
    getUsage: async () => NO_USAGE,
    putThumbnail: async (id, bytes) => {
      calls.push({ op: 'putThumb', id, byteLength: bytes.byteLength })
    }
  }

  // Optional on the interface. When absent the engine must fall back to a full
  // putDocument, so the budget tests need to control which shape they exercise.
  if (options.supportsMetadataPut !== false) {
    adapter.putDocumentMetadata = async (id: string, _metadata: StorageDocumentMetadata) => {
      calls.push({ op: 'putMetadata', id, byteLength: 0 })
    }
  }

  return adapter
}

export class FakeHttpError extends Error {
  readonly status: number
  constructor(status: number, message = `HTTP ${status}`) {
    super(message)
    this.name = 'FakeHttpError'
    this.status = status
  }
}

export type FaultConfig = {
  putStatus?: number
  deleteStatus?: number
  listStatus?: number
  /** Throw a fetch-level failure — what a CORS rejection actually looks like. */
  throwOn?: AdapterOp[]
}

/**
 * Real failures, which no existing fake produces.
 *
 * `installStorageFetch` is a happy-path in-memory Appwrite: no 503, no 403, no
 * `TypeError: Failed to fetch`. A mock is a written-down assumption — it can
 * confirm a belief, never contradict one.
 */
export function faultyAdapter(config: FaultConfig, inner = recordingAdapter()): RecordingAdapter {
  const shouldThrow = (op: AdapterOp): boolean => config.throwOn?.includes(op) ?? false
  const fail = (op: AdapterOp, status: number | undefined): void => {
    if (shouldThrow(op)) throw new TypeError('Failed to fetch')
    if (status != null) throw new FakeHttpError(status)
  }

  return {
    ...inner,
    calls: inner.calls,
    bodies: inner.bodies,
    count: inner.count,
    listDocuments: async () => {
      fail('list', config.listStatus)
      return inner.listDocuments()
    },
    putDocument: async (id, bytes, metadata, onProgress) => {
      fail('put', config.putStatus)
      return inner.putDocument(id, bytes, metadata, onProgress)
    },
    deleteDocument: async (id) => {
      // Record the attempt before failing: an Appwrite delete that returns 503
      // may still have succeeded, and the count is the only evidence of a retry.
      inner.calls.push({ op: 'delete', id, byteLength: 0 })
      fail('delete', config.deleteStatus)
      return inner.deleteDocument(id)
    }
  }
}

/** Let the engine's promise chain (store reads, outbox writes, adapter) finish. */
export async function settle(turns = 6): Promise<void> {
  for (let i = 0; i < turns; i++) await new Promise((resolve) => setTimeout(resolve, 0))
}

export type Harness = {
  engine: SyncEngine
  store: LocalCanvasStore
  outbox: Outbox
  adapter: RecordingAdapter
  /** Run every wake the engine has scheduled, until it stops scheduling more. */
  drainWakes(limit?: number): Promise<void>
  pendingWakes(): number
  dispose(): void
}

/**
 * An engine with no real timers, listeners, randomness or Web Locks.
 *
 * Everything the closure reaches is supplied here, so a test can advance the
 * scheduler by hand and assert that `dispose()` actually releases what it took.
 */
export function createHarness(
  overrides: Partial<SyncEngineDependencies> & { adapter?: RecordingAdapter } = {}
): Harness {
  const store = createMemoryLocalCanvasStore()
  const outbox = createMemoryOutbox()
  const adapter = overrides.adapter ?? recordingAdapter()

  let scheduled: (() => void)[] = []
  let connectivityBound = 0

  const engine = createSyncEngine({
    getStore: () => store,
    getOutbox: () => outbox,
    resolveTarget: async () => adapter,
    isOnline: () => true,
    subscribeConnectivity: () => {
      connectivityBound += 1
      return () => {
        connectivityBound -= 1
      }
    },
    schedule: (_ms, run): CancelScheduled => {
      scheduled.push(run)
      return () => {
        scheduled = scheduled.filter((entry) => entry !== run)
      }
    },
    now: () => Date.now(),
    random: () => 0,
    runExclusive: (_key, run) => run(),
    ...overrides
  })

  return {
    engine,
    store,
    outbox,
    adapter,
    pendingWakes: () => scheduled.length,
    boundConnectivity: () => connectivityBound,
    drainWakes: async (limit = 20) => {
      // The enqueue helpers fire `void kick()`, so the first pump is already in
      // flight and has scheduled nothing yet. Settle before looking at wakes,
      // or every assertion races the drain it is meant to observe.
      await settle()
      for (let i = 0; i < limit && scheduled.length > 0; i++) {
        const next = scheduled.shift()
        next?.()
        await settle()
      }
    },
    dispose: () => engine.dispose()
  } as Harness & { boundConnectivity(): number }
}

export async function seedSyncedDocument(
  store: LocalCanvasStore,
  id: string,
  bytes: Uint8Array
): Promise<void> {
  await store.writeCanvas({
    id,
    providerId: 's3-compatible',
    name: id,
    sourceFormat: 'fig',
    figBytes: bytes
  })
  const meta = await store.getMeta(id)
  await store.updateMeta(id, {
    syncStatus: 'synced',
    bodySyncedRevision: meta?.revision,
    lastSyncedAt: new Date().toISOString()
  })
}
