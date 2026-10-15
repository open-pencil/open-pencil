import { useEventListener, useLocalStorage } from '@vueuse/core'

import { IS_BROWSER } from '@open-pencil/core/constants'
import { randomInt } from '@open-pencil/scene-graph/random'

import { createActiveStorageAdapter } from '@/app/integrations/storage'
import {
  activeStorageProviderID,
  storagePreferencesComplete
} from '@/app/integrations/storage/preferences'
import { storageProviderRegistry } from '@/app/integrations/storage/providers'
import { storageCredentialStatuses } from '@/app/integrations/storage/runtime'
import type { StorageAdapter, StorageProviderID } from '@/app/integrations/storage/types'
import { currentStorageDestination } from '@/app/storage/destination'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import { createSyncEngine, StorageSyncBlockedError } from '@/app/storage/sync/engine'
import { migrateLocalTrashToRemote } from '@/app/storage/sync/migrate-trash'
import { getOutbox } from '@/app/storage/sync/outbox'
import {
  emitStorageWorkspaceEvent,
  type StorageWorkspaceEvent
} from '@/app/storage/workspace/events'

async function resolveConfiguredAdapter(providerID: StorageProviderID): Promise<StorageAdapter> {
  if (!storagePreferencesComplete(providerID)) {
    throw new StorageSyncBlockedError('Storage is not configured', 'unconfigured')
  }
  const provider = storageProviderRegistry.get(providerID)
  const statuses = await storageCredentialStatuses(providerID)
  const missingCredential = provider.credentialFields.some(
    (field) => field.required && statuses[field.id] !== 'configured'
  )
  if (missingCredential) {
    throw new StorageSyncBlockedError('Storage credentials are unavailable', 'credentials')
  }
  return createActiveStorageAdapter(providerID)
}

/**
 * Hold a cross-tab lock while draining: the outbox is shared IndexedDB, so two tabs would
 * otherwise upload the same job. A tab that does not get the lock skips this drain.
 */
export async function runWithWebLock(key: string, run: () => Promise<void>): Promise<void> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (!locks) return run()
  await locks.request(key, { ifAvailable: true }, async (lock) => {
    if (lock) await run()
  })
}

const GC_INTERVAL_MS = 24 * 60 * 60 * 1000

/** When each destination last swept unreferenced versions; a sweep runs at most once a day. */
const lastGarbageCollection = useLocalStorage<Record<string, number>>(
  'open-pencil:storage:last-gc',
  {}
)

async function collectGarbageDaily(): Promise<void> {
  const providerID = activeStorageProviderID.value
  const destination = currentStorageDestination(providerID)
  if (!destination) return
  const now = Date.now()
  if (now - (lastGarbageCollection.value[destination] ?? 0) < GC_INTERVAL_MS) return
  const adapter = await resolveConfiguredAdapter(providerID)
  if (!adapter.collectGarbage) return
  lastGarbageCollection.value = { ...lastGarbageCollection.value, [destination]: now }
  await adapter.collectGarbage(now)
}

/**
 * Workspace events, plus the automatic keep-both resolution of a conflict. The resolver is
 * loaded on demand: it reaches the open tabs, which themselves depend on this module.
 */
function emitWithConflictResolution(event: StorageWorkspaceEvent): void {
  emitStorageWorkspaceEvent(event)
  const id = event.documentId
  if (event.kind !== 'conflict' || id === undefined) return
  void import('@/app/storage/workspace/conflict').then((module) =>
    module.resolveConflictAutomatically(id)
  )
}

export const syncEngine = createSyncEngine({
  getStore: getLocalCanvasStore,
  getOutbox,
  activeProviderId: () => activeStorageProviderID.value,
  resolveAdapter: resolveConfiguredAdapter,
  destinationOf: currentStorageDestination,
  isOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine),
  subscribeConnectivity: (handlers) => {
    if (!IS_BROWSER) return () => undefined
    const stops = [
      useEventListener(window, 'online', () => handlers.online()),
      useEventListener(window, 'offline', () => handlers.offline()),
      useEventListener(window, 'pagehide', () => handlers.hidden()),
      useEventListener(document, 'visibilitychange', () => {
        if (document.visibilityState === 'hidden') handlers.hidden()
      })
    ]
    return () => {
      for (const stop of stops) stop()
    }
  },
  schedule: (ms, run) => {
    const timer = setTimeout(run, ms)
    return () => clearTimeout(timer)
  },
  now: () => Date.now(),
  random: () => (randomInt() >>> 0) / 0x1_0000_0000,
  runExclusive: runWithWebLock,
  emit: emitWithConflictResolution,
  collectGarbage: collectGarbageDaily
})

/** Trash marks made before the trash synced are queued once per device. */
const localTrashMigrated = useLocalStorage('open-pencil:storage:trash-synced', false)
let startup: Promise<void> | null = null

function migrateOnce(): Promise<void> {
  startup ??= (async () => {
    if (localTrashMigrated.value) return
    await migrateLocalTrashToRemote(getLocalCanvasStore(), enqueuePutMetadata)
    localTrashMigrated.value = true
  })().catch((error: unknown) => {
    console.warn('[Storage sync] local trash migration failed:', error)
  })
  return startup
}

/** Start or continue draining the outbox. Safe to call often. */
export async function kickSyncEngine(): Promise<void> {
  await migrateOnce()
  await syncEngine.kick()
}

export const enqueuePutCanvas = (canvasId: string, revision: number): Promise<void> =>
  syncEngine.enqueue(canvasId, 'putCanvas', revision)
export const enqueuePutMetadata = (canvasId: string, revision: number): Promise<void> =>
  syncEngine.enqueue(canvasId, 'putMetadata', revision)
export const enqueuePutThumb = (canvasId: string, revision: number): Promise<void> =>
  syncEngine.enqueue(canvasId, 'putThumb', revision)
export const enqueueDeleteCanvas = (canvasId: string): Promise<void> =>
  syncEngine.enqueue(canvasId, 'deleteCanvas', 0)
/** Retry durable work immediately after storage settings or credentials change. */
export const resumeStorageSync = (): Promise<void> => syncEngine.resume()
/** Commit a design's waiting work now: it is closing, or the page is going away. */
export const flushStorageSync = (canvasId?: string): Promise<void> => syncEngine.flush(canvasId)
/** After credentials are cleared: drop the local mirror and the outbox. */
export const clearStorageLocalMirror = (): Promise<void> => syncEngine.clearLocalMirror()
