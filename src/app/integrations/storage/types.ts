import type { CredentialResolver } from '@/app/settings/credentials/types'

export type StorageProviderID = string
export type StorageFieldID = string

/**
 * Where documents live: a provider, the account or server profile used with it, and, for
 * providers that hold several collections such as Cloud workspaces, which one.
 */
export type StorageLocation = {
  providerId: StorageProviderID
  /** Defaults to `default`, the one profile of single-account providers. */
  profileId?: string
  containerId?: string
}

export type StorageDocumentBinding = StorageLocation & {
  documentId: string
}

export type StorageTransferProgress = {
  transferredBytes: number
  totalBytes: number | null
}

export type StorageDocumentMetadata = {
  name: string
  updatedAt: string
}

export type StorageDocument = StorageDocumentMetadata & {
  id: string
  thumbnailURL?: string | null
  metadataAuthoritative?: boolean
  /**
   * The provider's opaque version of the stored bytes, for providers that track revisions. A
   * local copy based on the same revision is current.
   */
  revision?: string | null
}

/** Stored bytes and the revision they are, when the provider tracks revisions. */
export type StorageDocumentContent = {
  bytes: Uint8Array
  revision: string | null
}

export type StoragePutOptions = {
  /**
   * The revision the local bytes were edited from. A provider that tracks revisions refuses
   * the write with `StorageRevisionConflictError` when the stored revision has moved on.
   */
  baseRevision?: string | null
}

export type StoragePutResult = {
  /** The revision the write created, or null when the provider does not track revisions. */
  revision: string | null
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

export interface LibraryObjectSummary {
  key: string
  size: number | null
  etag: string | null
}

export interface LibraryObjectValue {
  bytes: Uint8Array | null
  etag: string | null
}

export interface LibraryObjectWriteOptions {
  ifMatch?: string
  ifNoneMatch?: '*'
}

export interface LibraryObjectStore {
  getObject(key: string): Promise<Uint8Array | null>
  getObjectValue?(key: string): Promise<LibraryObjectValue>
  putObject(
    key: string,
    bytes: Uint8Array,
    contentType: string,
    options?: LibraryObjectWriteOptions
  ): Promise<void>
  listObjects(prefix: string): Promise<LibraryObjectSummary[]>
}

export interface StorageAdapter {
  testConnection(): Promise<StorageConnectionResult>
  listDocuments(): Promise<StorageDocument[]>
  getDocument(
    id: string,
    onProgress?: (progress: StorageTransferProgress) => void,
    signal?: AbortSignal
  ): Promise<StorageDocumentContent>
  putDocument(
    id: string,
    bytes: Uint8Array,
    metadata: StorageDocumentMetadata,
    onProgress?: (progress: StorageTransferProgress) => void,
    options?: StoragePutOptions
  ): Promise<StoragePutResult>
  deleteDocument(id: string): Promise<void>
  getDocumentMetadata?(id: string): Promise<StorageDocumentMetadata | null>
  getUsage(): Promise<StorageUsage>
  getThumbnail?(id: string): Promise<Uint8Array | null>
  putThumbnail?(id: string, bytes: Uint8Array): Promise<void>
  libraryObjects?: LibraryObjectStore
}

export type StoragePreferenceField = {
  id: StorageFieldID
  label: string
  kind: 'text' | 'url'
  required?: boolean
  placeholder?: string
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
  profileId: string
  containerId?: string
}

export type StorageProviderRegistration = {
  id: StorageProviderID
  label: string
  description: string
  preferenceFields: readonly StoragePreferenceField[]
  credentialFields: readonly StorageCredentialField[]
  createAdapter(runtime: StorageProviderRuntime): StorageAdapter
}

export type StorageAdapterContext = {
  preferences: Readonly<Record<StorageFieldID, string>>
  credentials: CredentialResolver
  profileId?: string
  containerId?: string
}
