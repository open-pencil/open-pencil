import type { CredentialResolver } from '@/app/settings/credentials/types'

export type StorageProviderID = string
export type StorageFieldID = string
/** Native bytes a stored document holds. Missing legacy metadata means `.fig`. */
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
  sourceFormat: StorageDocumentFormat
  /** Soft-delete marker; the document keeps its bytes until it is permanently deleted. */
  trashedAt: string | null
  /** Content identity of the body this metadata describes; absent means unknown. */
  bodyId?: string
  /** Whole-document state identity (body and semantic metadata), for conflict detection. */
  stateId?: string
}

export type StorageDocument = StorageDocumentMetadata & {
  id: string
  thumbnailURL?: string | null
  metadataAuthoritative?: boolean
  /** The document has a versioned head; a legacy document is one `.fig` plus its sidecar. */
  versioned?: boolean
  /** The head's retained states, newest first; only versioned documents have one. */
  history?: string[]
}

/** What a versioned commit published: the state now at the head, and the head it replaced. */
export type CommittedVersion = {
  stateId: string
  bodyId: string
  parentStateId: string | null
}

/** The states this device knows of, which a commit checks the remote head against. */
export type VersionCommitBase = {
  baseStateId: string | null
  lastPublishedStateId: string | null
}

export type VersionCommitOptions = {
  /** Refuse the commit with a conflict when the head moved past every state this device knows. */
  expectedBase?: VersionCommitBase
  /** A retry checks whether the body is already stored before sending it again. */
  retry?: boolean
}

/** A versioned document as opened: its bytes and the committed state they belong to. */
export type StorageDocumentVersion = {
  bytes: Uint8Array
  metadata: StorageDocumentMetadata
  versioned: boolean
  history: string[]
}

export type GarbageCollectionResult = {
  deletedBodies: number
  deletedManifests: number
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
  ): Promise<Uint8Array>
  /** Bytes plus the committed state they belong to; legacy documents report `versioned: false`. */
  getDocumentVersion?(
    id: string,
    onProgress?: (progress: StorageTransferProgress) => void,
    signal?: AbortSignal
  ): Promise<StorageDocumentVersion>
  /**
   * Versioned commit: ensure the body, write the manifest, then update the head, which is the
   * only commit point. `readWritten` runs again after the body upload, so the manifest carries
   * metadata as it is when the upload completes (a rename during the upload is included).
   */
  putDocumentVersion(
    id: string,
    bytes: Uint8Array,
    readWritten: () => Promise<StorageDocumentMetadata>,
    onProgress?: (progress: StorageTransferProgress) => void,
    options?: VersionCommitOptions
  ): Promise<CommittedVersion>
  /** Metadata-only version: a new manifest reusing the stored body, then the head. */
  putMetadataVersion(
    id: string,
    written: StorageDocumentMetadata,
    options?: VersionCommitOptions
  ): Promise<CommittedVersion>
  /** Legacy sidecar write for a document that has no versioned head yet. */
  putDocumentMetadata?(id: string, metadata: StorageDocumentMetadata): Promise<void>
  /** Delete unreferenced bodies and manifests older than the retention safety window. */
  collectGarbage?(nowMs?: number): Promise<GarbageCollectionResult>
  deleteDocument(id: string): Promise<void>
  getDocumentMetadata?(id: string): Promise<StorageDocument | null>
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
}
