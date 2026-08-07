import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import type { Outbox } from '@/app/storage/sync/outbox'

/**
 * The two things an operation has to reach to stop syncing something.
 *
 * Pausing backup and disconnecting a target are different decisions with the
 * same reach: rows to re-mark in the local store, queued uploads to cancel in
 * the outbox. Both are injected rather than imported so a test can drive them
 * without a live IndexedDB.
 */
export type StorageSyncDependencies = {
  store: LocalCanvasStore
  outbox: Outbox
}
