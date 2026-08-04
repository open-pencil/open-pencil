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
}

export type StorageDocument = StorageDocumentMetadata & {
  id: string
  thumbnailUrl?: string | null
  metadataAuthoritative?: boolean
}

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
  putDocument(
    id: string,
    bytes: Uint8Array,
    metadata: StorageDocumentMetadata,
    onProgress?: (progress: StorageTransferProgress) => void
  ): Promise<void>
  putDocumentMetadata?(id: string, metadata: StorageDocumentMetadata): Promise<void>
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
