import type { CloudProviderId } from '@/app/cloud/types'

export type LocalSyncStatus = 'synced' | 'pending' | 'error' | 'conflict'

/** Metadata for a cloud canvas cached on device (document bytes stored separately). */
export type LocalCanvasMeta = {
  id: string
  providerId: CloudProviderId
  name: string
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
}

export type LocalCanvasWriteInput = {
  id: string
  providerId: CloudProviderId
  name: string
  updatedAt?: string
  figBytes: Uint8Array
  thumbBytes?: Uint8Array | null
  /** If set, keep this revision; otherwise increment from existing. */
  revision?: number
  syncStatus?: LocalSyncStatus
}
