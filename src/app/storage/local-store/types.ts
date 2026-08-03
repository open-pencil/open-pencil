import type { StorageDocumentFormat, StorageProviderID } from '@/app/integrations/storage/types'

export type LocalSyncStatus = 'synced' | 'pending' | 'error' | 'conflict'

/** Metadata for a stored canvas cached on device (document bytes stored separately). */
export type LocalCanvasMeta = {
  id: string
  providerId: StorageProviderID
  name: string
  sourceFormat: StorageDocumentFormat
  trashedAt: string | null
  updatedAt: string
  /** Monotonic local revision; increments on each local write. */
  revision: number
  /**
   * Identity of the current local body, or `null` for an index-only row whose
   * bytes were never downloaded. Derived from content, not from `revision`:
   * a rename bumps the revision without changing a single byte of the body.
   */
  bodyId: string | null
  /**
   * Body identity last CONFIRMED on the remote. `null` means unknown or never
   * confirmed — never "the current bytes are up there".
   *
   * The body is current remotely only when `bodyId !== null && bodyId ===
   * syncedBodyId`. This is the only field that proves a durable remote copy
   * exists; `syncStatus` does not, because it used to be set by a metadata
   * sidecar write alone, which made eviction drop the last copy of a document
   * the remote had never seen.
   */
  syncedBodyId: string | null
  syncStatus: LocalSyncStatus
  lastSyncedAt: string | null
  lastSyncError: string | null
  /** Soft-deleted; hidden from UI until remote delete completes. */
  tombstoned: boolean
  hasFig: boolean
  hasThumb: boolean
  /** Size of the cached fig blob in bytes (set on write; backfilled by eviction). */
  figSize?: number
  /** Last time this canvas was opened on this device (LRU eviction key). */
  lastOpenedAt?: string
}

/** Index-only row for remote canvases not yet downloaded (no fig body). */
export type LocalCanvasIndexInput = Omit<
  LocalCanvasMeta,
  | 'hasFig'
  | 'hasThumb'
  | 'tombstoned'
  | 'revision'
  | 'sourceFormat'
  | 'trashedAt'
  | 'bodyId'
  | 'syncedBodyId'
> & {
  revision?: number
  hasFig?: boolean
  hasThumb?: boolean
  sourceFormat?: StorageDocumentFormat
  trashedAt?: string | null
  bodyId?: string | null
  syncedBodyId?: string | null
}

export type LocalCanvasWriteInput = {
  id: string
  providerId: StorageProviderID
  name: string
  sourceFormat?: StorageDocumentFormat
  updatedAt?: string
  trashedAt?: string | null
  figBytes: Uint8Array
  thumbBytes?: Uint8Array | null
  /** If set, keep this revision; otherwise increment from existing. */
  revision?: number
  syncStatus?: LocalSyncStatus
  /** Identity of `figBytes`. Computed by the caller so the hash runs once. */
  bodyId?: string | null
  /** Set when the bytes being written are known to already exist remotely. */
  syncedBodyId?: string | null
}
