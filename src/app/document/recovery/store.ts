import { createIdbRecoveryStore } from '@/app/document/recovery/idb'
import { createMemoryRecoveryStore } from '@/app/document/recovery/memory'
import type {
  RecoverySnapshot,
  RecoverySnapshotInput,
  RecoverySnapshotMeta,
  RecoveryStore
} from '@/app/document/recovery/types'

let singleton: RecoveryStore | null = null
let memoryFallback = false

function warnMemoryFallback(error?: unknown): void {
  if (memoryFallback) return
  console.warn('[Recovery] IndexedDB unavailable; crash recovery is limited to this session', error)
  memoryFallback = true
}

/** A cover is only a preview: one that cannot be read is left out, and the copy still counts. */
async function readCoverOrNone(store: RecoveryStore, id: string): Promise<Uint8Array | null> {
  try {
    return await store.readCover(id)
  } catch (error) {
    console.warn('[Recovery] Could not read the cover:', error)
    return null
  }
}

function createResilientRecoveryStore(primary: RecoveryStore): RecoveryStore {
  let current = primary
  let queue = Promise.resolve()

  function serialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation, operation)
    queue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  async function switchToMemory(error: unknown): Promise<RecoveryStore> {
    if (current !== primary) return current
    warnMemoryFallback(error)
    const memory = createMemoryRecoveryStore()
    try {
      const snapshots = await primary.list()
      for (const metadata of snapshots) {
        const snapshot = await primary.read(metadata.id)
        if (snapshot)
          await memory.write({ ...snapshot, cover: await readCoverOrNone(primary, metadata.id) })
      }
    } catch (migrationError) {
      console.warn('[Recovery] Failed to migrate IndexedDB snapshots to memory:', migrationError)
    }
    current = memory
    return memory
  }

  function run<T>(operation: (store: RecoveryStore) => Promise<T>): Promise<T> {
    return serialized(async () => {
      try {
        return await operation(current)
      } catch (error) {
        if (current !== primary) throw error
        return operation(await switchToMemory(error))
      }
    })
  }

  function removeFromAll(id: string): Promise<void> {
    return serialized(async () => {
      await primary.remove(id)
      if (current !== primary) await current.remove(id)
    })
  }

  /**
   * Claims the durable copy, so other windows stop listing it. A failed claim fails the restore
   * rather than falling back, but once IndexedDB has failed the durable claim is only attempted.
   */
  function claimInAll(id: string, sessionId: string): Promise<void> {
    return serialized(async () => {
      if (current === primary) return primary.claim(id, sessionId)
      await current.claim(id, sessionId)
      await primary.claim(id, sessionId).catch((error: unknown) => {
        console.warn('[Recovery] Failed to claim the IndexedDB snapshot:', error)
      })
    })
  }

  function clearAll(): Promise<void> {
    return serialized(async () => {
      await primary.clear()
      if (current !== primary) await current.clear()
    })
  }

  return {
    list: () => run((store) => store.list()),
    read: (id: string): Promise<RecoverySnapshot | null> => run((store) => store.read(id)),
    // A failed preview never moves the copies to memory.
    readCover: (id: string) => serialized(() => readCoverOrNone(current, id)),
    write: (input: RecoverySnapshotInput): Promise<RecoverySnapshotMeta> =>
      run((store) => store.write(input)),
    remove: removeFromAll,
    claim: claimInAll,
    clear: clearAll
  }
}

export function getRecoveryStore(): RecoveryStore {
  if (singleton) return singleton
  if (typeof indexedDB === 'undefined') {
    warnMemoryFallback()
    singleton = createMemoryRecoveryStore()
    return singleton
  }
  memoryFallback = false
  singleton = createResilientRecoveryStore(createIdbRecoveryStore())
  return singleton
}

export function isRecoveryStoreMemoryFallback(): boolean {
  return memoryFallback
}

export function resetRecoveryStoreForTests(store?: RecoveryStore): void {
  singleton = store ?? null
  memoryFallback = false
}
