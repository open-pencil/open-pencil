import type { StorageDocumentFormat } from '@/app/integrations/storage/types'
import type { StorageTargetID } from '@/app/storage/target'

export type LocalSyncStatus = 'synced' | 'pending' | 'error' | 'conflict'

/** Metadata for a stored canvas cached on device (document bytes stored separately). */
export type LocalCanvasMeta = {
  id: string
  /**
   * Where this document replicates to, or `null` for local-only.
   *
   * Replaces `providerId`, which meant "which shelf this belongs to" and made
   * location part of identity — so a listing that resolved late could retag a
   * row into the wrong bucket, and switching providers hid every document.
   * A target names one immutable provider/configuration/credential tuple, so a
   * stale read can at worst record a stale sync state, never move a document.
   */
  syncTargetId: StorageTargetID | null
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
  /** Failure of the document body or its metadata. Never a thumbnail. */
  lastSyncError: string | null
  /**
   * Failure of the thumbnail upload alone.
   *
   * Kept apart from `lastSyncError` because the two mean very different things
   * to the user: the document is safe either way, but a `putThumb` failure
   * writing into `lastSyncError` presented a perfectly synced document as
   * broken. A stale preview is cosmetic and gets a correspondingly quiet
   * signal; nothing derives `syncStatus` from this field.
   */
  lastThumbSyncError: string | null
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
  | 'lastThumbSyncError'
> & {
  revision?: number
  hasFig?: boolean
  hasThumb?: boolean
  sourceFormat?: StorageDocumentFormat
  trashedAt?: string | null
  bodyId?: string | null
  syncedBodyId?: string | null
  lastThumbSyncError?: string | null
}

export type LocalCanvasWriteInput = {
  id: string
  syncTargetId: StorageTargetID | null
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
