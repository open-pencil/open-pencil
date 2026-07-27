import type { CredentialResolver } from '@/app/settings/credentials/types'

export type StorageProviderID = string
export type StorageFieldID = string

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
