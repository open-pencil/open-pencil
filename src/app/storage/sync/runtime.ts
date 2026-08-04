import { IS_BROWSER } from '@open-pencil/core/constants'

import {
  createActiveStorageAdapter,
  storageCredentialStatuses,
  storagePreferencesComplete,
  storageProviderRegistry,
  type StorageAdapter
} from '@/app/integrations/storage'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import { createSyncEngine, StorageSyncBlockedError } from '@/app/storage/sync/engine'
import { migrateLegacyOutboxJobs } from '@/app/storage/sync/migrate-jobs'
import { getOutbox } from '@/app/storage/sync/outbox'
import { repairOrphanedPendingRows } from '@/app/storage/sync/repair'
import { markCrossTabLockUnavailable } from '@/app/storage/sync/status'
import { providerIdOfTarget, targetIsCurrent, type StorageTargetID } from '@/app/storage/target'

/**
 * Resolve the adapter for the target a job captured.
 *
 * Collapses the three module-singleton reads the engine used to perform inline
 * — `storagePreferencesComplete`, `storageCredentialStatuses` and
 * `createActiveStorageAdapter` — into the one injectable seam.
 *
 * Every refusal below used to be a silent redirect. A job carries a TARGET id
 * (`provider#configuration`), not a provider id, so the provider has to be
 * recovered from the target rather than from the current selection; and a
 * target that no longer names its provider's destination must fail rather than
 * borrow the destination that replaced it, because the bytes were promised to
 * the old one.
 */
async function resolveConfiguredTarget(targetId: StorageTargetID | null): Promise<StorageAdapter> {
  if (targetId === null) {
    throw new StorageSyncBlockedError('This document has no storage destination')
  }
  const providerID = providerIdOfTarget(targetId)
  if (!providerID) {
    throw new StorageSyncBlockedError('This document was synced by a provider this build lacks')
  }
  if (!targetIsCurrent(targetId)) {
    throw new StorageSyncBlockedError('Storage settings no longer point at this document’s bucket')
  }
  if (!storagePreferencesComplete(providerID)) {
    throw new StorageSyncBlockedError('Storage is not configured')
  }
  const provider = storageProviderRegistry.get(providerID)
  const statuses = await storageCredentialStatuses(providerID)
  const missingCredential = provider.credentialFields.some(
    (field) => field.required && statuses[field.id] !== 'configured'
  )
  if (missingCredential) {
    throw new StorageSyncBlockedError('Storage credentials are unavailable')
  }
  return createActiveStorageAdapter(providerID)
}

/**
 * Hold a cross-tab exclusive lock for the duration of a drain.
 *
 * The outbox is shared IndexedDB but the in-tab `pumping` flag is per-realm, so
 * two open tabs would both select the same job and upload the same bytes. The
 * loser then found the blob evicted by the winner, failed, and demoted a healthy
 * document to `error`. `ifAvailable` means a tab that loses the lock simply
 * skips this drain rather than queueing another full pass behind it.
 *
 * Environments without `navigator.locks` run unlocked — that re-exposes the
 * two-tab race, so it must not be silent: warn once and mark the sync status
 * state, where the status surface and tests can see the degraded guarantee.
 */
let warnedUnlockedDrain = false

export async function runWithWebLock(key: string, run: () => Promise<void>): Promise<void> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (!locks) {
    if (!warnedUnlockedDrain) {
      warnedUnlockedDrain = true
      console.warn(
        '[Storage sync] navigator.locks is unavailable: cross-tab drain exclusivity is off, so two open tabs can upload the same document concurrently.'
      )
    }
    markCrossTabLockUnavailable()
    return run()
  }
  await locks.request(key, { ifAvailable: true }, async (lock) => {
    if (!lock) return
    await run()
  })
}

export const syncEngine = createSyncEngine({
  getStore: getLocalCanvasStore,
  getOutbox,
  resolveTarget: resolveConfiguredTarget,
  isOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine),
  subscribeConnectivity: (handlers) => {
    if (!IS_BROWSER) return () => {}
    const online = () => handlers.online()
    const offline = () => handlers.offline()
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  },
  schedule: (ms, run) => {
    const timer = setTimeout(run, ms)
    return () => clearTimeout(timer)
  },
  now: () => Date.now(),
  random: () => (crypto.getRandomValues(new Uint8Array(1))[0] ?? 0) / 256,
  runExclusive: runWithWebLock
})

export const kickSyncEngine = (): Promise<void> => syncEngine.kick()
export const enqueuePutCanvas = (canvasId: string, revision: number): Promise<void> =>
  syncEngine.enqueuePutCanvas(canvasId, revision)
export const enqueuePutMetadata = (canvasId: string, revision: number): Promise<void> =>
  syncEngine.enqueuePutMetadata(canvasId, revision)
export const enqueuePutThumb = (canvasId: string, revision: number): Promise<void> =>
  syncEngine.enqueuePutThumb(canvasId, revision)
export const enqueueDeleteCanvas = (canvasId: string): Promise<void> =>
  syncEngine.enqueueDeleteCanvas(canvasId)
export const resumeStorageSync = (): Promise<void> => syncEngine.resume()
export const clearStorageLocalMirror = (): Promise<void> => syncEngine.clearLocalMirror()

/**
 * Bring the durable queue up to the current schema, reconcile the rows against
 * it, then start draining.
 *
 * The migration has to complete BEFORE the first pump: a legacy job carries no
 * target, and `runJob` deliberately refuses to guess one. Draining first would
 * park perfectly repairable jobs behind a blocked queue on every cold start.
 *
 * The repair sweep runs BETWEEN the two, and the order is load-bearing in both
 * directions. Sweeping before the migration would judge rows whose jobs are
 * about to be pinned — an untargeted job looks like no job at all, so the sweep
 * would "fix" a row that was never broken. Sweeping after the pump would race
 * the drain that is busy changing the very rows it inspects.
 */
export async function startStorageSync(): Promise<void> {
  try {
    await migrateLegacyOutboxJobs()
  } catch (error) {
    // A migration that cannot read the queue must not also prevent the queue
    // from running — jobs already carrying a target are unaffected by it.
    console.warn('[Storage sync] legacy job migration failed:', error)
  }
  try {
    await repairOrphanedPendingRows()
  } catch (error) {
    // Same reasoning: a sweep that cannot read local state leaves the stranded
    // rows exactly as it found them, and healthy queued work still drains.
    console.warn('[Storage sync] orphaned pending repair failed:', error)
  }
  await syncEngine.kick()
}
