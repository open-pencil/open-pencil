import type { CredentialResolver } from '@/app/settings/credentials/types'

export type StorageProviderID = string
export type StorageFieldID = string
export type StorageDocumentFormat = 'fig' | 'deck'

export type StorageDocumentBinding = {
  providerId: StorageProviderID
  documentId: string
}

export type StorageTransferProgress = {
  transferredBytes: number
  totalBytes: number | null
}

export type StorageDocumentMetadata = {
  name: string
  updatedAt: string
  /** Native bytes stored for this document. Missing legacy metadata defaults to `.fig`. */
  sourceFormat: StorageDocumentFormat
  /** Soft-delete marker. The document bytes remain available until permanent deletion. */
  trashedAt: string | null
  /**
   * Content identity of the body this metadata describes. Optional: sidecars
   * written before identity existed lack it, and absence means "unknown",
   * never "different". See `sync-conflict-detection`.
   */
  bodyId?: string
  /** Whole-document state identity (body + semantic metadata), for conflict detection. */
  stateId?: string
}

export type StorageDocument = StorageDocumentMetadata & {
  id: string
  thumbnailUrl?: string | null
  metadataAuthoritative?: boolean
}

/** What a versioned commit published: the state now at the head. */
export type CommittedVersion = { stateId: string; bodyId: string }

export type StorageUsage = {
  bytesUsed: number
  objectCount: number
  documentCount: number
}

export type StorageConnectionResult = {
  ok: boolean
  message: string
}

export interface StorageAdapter {
  testConnection(): Promise<StorageConnectionResult>
  listDocuments(): Promise<StorageDocument[]>
  getDocument(
    id: string,
    onProgress?: (progress: StorageTransferProgress) => void
  ): Promise<Uint8Array>
  /**
   * Upload the document body only. Metadata is NOT accepted here: a dispatch-time
   * snapshot written after a multi-second upload can overwrite a rename that
   * landed while the bytes were on the wire. The caller writes metadata after
   * completion through `putDocumentMetadata`, read from the row at that moment.
   */
  putDocument(
    id: string,
    bytes: Uint8Array,
    onProgress?: (progress: StorageTransferProgress) => void
  ): Promise<void>
  putDocumentMetadata(id: string, metadata: StorageDocumentMetadata): Promise<void>
  /**
   * Versioned-layout commit: ensure the body object, write the manifest, then
   * update the head — the head is the only commit point. `readWritten` is
   * invoked again after the body upload completes, so the committed manifest
   * carries completion-time metadata (the rename-during-upload rule). Adapters
   * without a versioned layout omit this and the engine uses the two-step
   * `putDocument` + `putDocumentMetadata` path.
   */
  putDocumentVersion?(
    id: string,
    bytes: Uint8Array,
    readWritten: () => Promise<StorageDocumentMetadata>,
    onProgress?: (progress: StorageTransferProgress) => void
  ): Promise<CommittedVersion>
  /** Metadata-only version: a new manifest reusing the existing body, then head. */
  putMetadataVersion?(id: string, written: StorageDocumentMetadata): Promise<CommittedVersion>
  /** HEAD on the versioned body object — the migration re-confirmation sweep. */
  hasRemoteBody?(bodyId: string): Promise<boolean>
  /**
   * Delete unreferenced bodies/manifests older than the retention safety
   * window. Versioned-layout adapters only; the engine runs it best-effort
   * when the queue idles.
   */
  collectGarbage?(nowMs?: number): Promise<{ deletedBodies: number; deletedManifests: number }>
  deleteDocument(id: string): Promise<void>
  getDocumentMetadata?(id: string): Promise<StorageDocumentMetadata | null>
  getUsage(): Promise<StorageUsage>
  getThumbnail?(id: string): Promise<Uint8Array | null>
  putThumbnail?(id: string, bytes: Uint8Array): Promise<void>
}

export type StoragePreferenceField = {
  id: StorageFieldID
  label: string
  kind: 'text' | 'url'
  required?: boolean
  placeholder?: string
  /**
   * Withhold this value from copied diagnostics and error detail.
   *
   * Credentials live in `credentialFields` and never reach a preference, so no
   * provider declares this yet — which is precisely the risk. Diagnostics
   * copied preference values by shape, so the first provider to put a token or
   * a signed URL in a preference would have leaked it into a bug report with no
   * code change anywhere. Classification is explicit so that cannot happen
   * silently.
   */
  secret?: boolean
}

export type StorageCredentialField = {
  id: StorageFieldID
  label: string
  required?: boolean
  placeholder?: string
}

export type StorageProviderRuntime = {
  preferences: Readonly<Record<StorageFieldID, string>>
  resolveCredential(field: StorageFieldID): Promise<string | null>
}

export type StorageProviderRegistration = {
  id: StorageProviderID
  label: string
  description: string
  icon?: string
  /** Where to obtain credentials for this provider; rendered beside the description. */
  helpUrl?: string
  helpLabel?: string
  /** Short cost summary, so the trade-off is visible before signing up. */
  pricingNote?: string
  /**
   * What this destination can do about two devices editing one document,
   * named by the decision the UI makes with it: `'none'` means overwrites are
   * silent and the workspace must say so; `'detect'` means a moved remote is
   * caught before a write and the conflict UX applies; `'prevent'` (reserved
   * for providers with probe-verified conditional writes) means a clobbering
   * write is refused outright.
   */
  conflictProtection: 'none' | 'detect' | 'prevent'
  /** Offer the shared S3 CORS configuration helper for browser access. */
  corsConfiguration?: 's3'
  preferenceFields: readonly StoragePreferenceField[]
  credentialFields: readonly StorageCredentialField[]
  createAdapter(runtime: StorageProviderRuntime): StorageAdapter
}

export type StorageAdapterContext = {
  preferences: Readonly<Record<StorageFieldID, string>>
  credentials: CredentialResolver
  profileId?: string
}
