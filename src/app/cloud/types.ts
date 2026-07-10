/** Cloud storage provider id. v1: S3-compatible only; registry grows later. */
export type CloudProviderId = 's3-compatible'

export type S3CompatibleConfig = {
  endpoint: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  /**
   * Optional SigV4 signing region. Usually inferred from the endpoint
   * (e.g. s3.eu-central-003.backblazeb2.com → eu-central-003).
   */
  region?: string
}

export type CloudProviderConfig = {
  's3-compatible': S3CompatibleConfig
}

export type CloudCanvasMeta = {
  name: string
  updatedAt: string
}

export type CloudCanvas = CloudCanvasMeta & {
  id: string
  /** Optional data URL or remote URL for card preview */
  thumbnailUrl?: string | null
  /** Local-first sync status when known from the device cache */
  syncStatus?: 'synced' | 'pending' | 'error' | 'conflict' | null
}

export type CloudDocumentBinding = {
  providerId: CloudProviderId
  canvasId: string
}

/** Usage of the OpenPencil namespace inside the configured bucket. */
export type CloudStorageUsage = {
  /** Total bytes under open_pencil_storage/ */
  bytesUsed: number
  /** All objects (fig, meta, thumbs, marker, …) */
  objectCount: number
  /** Canvas .fig documents only */
  canvasCount: number
}

/** Result of Test connection — always includes whether auto CORS was applied. */
export type CloudConnectionTestResult = {
  ok: boolean
  /** Human-readable status (success or failure). */
  message: string
  /** True if PutBucketCors succeeded during this test. */
  corsApplied: boolean
  /** True when failure is likely browser CORS / preflight. */
  isCorsFailure: boolean
  /** Extra detail when auto CORS failed (permissions, network, etc.). */
  corsError: string | null
}

/**
 * Backend-agnostic storage surface. Home UI and document I/O use only this.
 * New backends (Drive, …) implement the same methods.
 */
export interface CloudStorageAdapter {
  readonly id: CloudProviderId
  /**
   * Verify credentials and ensure namespace. Always attempts to apply web-friendly
   * bucket CORS first (works reliably from desktop; best-effort from browser).
   */
  testConnection(): Promise<CloudConnectionTestResult>
  ensureNamespace(): Promise<void>
  listCanvases(): Promise<CloudCanvas[]>
  getCanvas(id: string): Promise<Uint8Array>
  putCanvas(id: string, bytes: Uint8Array, meta: CloudCanvasMeta): Promise<void>
  deleteCanvas(id: string): Promise<void>
  /** Bytes / object counts under the OpenPencil namespace (not full account free space). */
  getStorageUsage(): Promise<CloudStorageUsage>
  putThumbnail?(id: string, jpegBytes: Uint8Array): Promise<void>
  getThumbnail?(id: string): Promise<Uint8Array | null>
}

export type CloudProviderDef = {
  id: CloudProviderId
  label: string
  /** Short help for settings UI */
  description: string
}
