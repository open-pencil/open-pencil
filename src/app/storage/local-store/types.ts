import type { StorageDocumentFormat, StorageProviderID } from '@/app/integrations/storage/types'

export type LocalSyncStatus = 'synced' | 'pending' | 'error' | 'conflict'

/** Metadata for a stored canvas cached on device (document bytes stored separately). */
export type LocalCanvasMeta = {
  id: string
  providerId: StorageProviderID
  name: string
  /** Native bytes of the design; a slide deck is listed and synced but never opened here. */
  sourceFormat: StorageDocumentFormat
  updatedAt: string
  /** Monotonic local revision; increments on each local write. */
  revision: number
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
  /** When it was moved to the trash; the library lists it again once it is restored. */
  trashedAt: string | null
  /**
   * Identity of the local body, or null for an index-only row whose bytes were never downloaded.
   * Derived from content, not `revision`: a rename bumps the revision without changing the body.
   */
  bodyId: string | null
  /**
   * Body identity last confirmed at the destination; null means unknown, never "the current
   * bytes are there". The body is current remotely only when `bodyId === syncedBodyId`.
   */
  syncedBodyId: string | null
  /**
   * The remote state the local edits are based on. A remote head that moved away from it means
   * another device wrote. Null (a legacy or rebased row) never conflicts on its own.
   */
  baseStateId: string | null
  /** The state this device last published, even when the row moved on during the upload. */
  lastPublishedStateId: string | null
  /** The head this device's last publish replaced; a fork leaves it in the remote history. */
  lastPublishedParentStateId: string | null
  /** `syncedBodyId` was confirmed by a versioned commit (`bodies/<id>` exists). */
  versionedConfirmed: boolean
  /**
   * The destination (provider and bucket) that confirmed this row's sync state. When storage
   * points elsewhere, the confirmations no longer hold and the row is rebased before it syncs.
   */
  syncDestination: string | null
}

/** Sync-state fields a listing or a remote download establishes for a row. */
export type LocalCanvasSyncFields = Pick<
  LocalCanvasMeta,
  | 'sourceFormat'
  | 'trashedAt'
  | 'bodyId'
  | 'syncedBodyId'
  | 'baseStateId'
  | 'versionedConfirmed'
  | 'syncDestination'
>

/** Index-only row for remote canvases not yet downloaded (no fig body). */
export type LocalCanvasIndexInput = Omit<
  LocalCanvasMeta,
  | 'hasFig'
  | 'hasThumb'
  | 'tombstoned'
  | 'revision'
  | keyof LocalCanvasSyncFields
  // This device's publish history is never set from a listing.
  | 'lastPublishedStateId'
  | 'lastPublishedParentStateId'
> &
  Partial<LocalCanvasSyncFields> & {
    revision?: number
    hasFig?: boolean
    hasThumb?: boolean
  }

export type LocalCanvasWriteInput = {
  id: string
  providerId: StorageProviderID
  name: string
  updatedAt?: string
  figBytes: Uint8Array
  thumbBytes?: Uint8Array | null
  /** If set, keep this revision; otherwise increment from existing. */
  revision?: number
  syncStatus?: LocalSyncStatus
  sourceFormat?: LocalCanvasMeta['sourceFormat']
  trashedAt?: string | null
  /** Identity of `figBytes`, computed by the caller so the hash runs once. */
  bodyId?: string | null
  /** Set when the bytes are known to be stored at the destination already. */
  syncedBodyId?: string | null
  baseStateId?: string | null
  versionedConfirmed?: boolean
  syncDestination?: string | null
}
