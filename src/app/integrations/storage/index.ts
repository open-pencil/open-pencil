export {
  activeStorageProviderID,
  readStoragePreferences,
  storagePreferencesComplete,
  writeStoragePreference
} from './preferences'
export type { StoragePreferences } from './preferences'
export { S3_STORAGE_PROVIDER, storageProviderRegistry } from './providers'
export { defineStorageProvider, StorageProviderRegistry } from './registry'
export { createS3StorageAdapter } from './s3/adapter'
export type { S3StorageAdapter } from './s3/adapter'
export type { S3CompatibleConfig, S3ConnectionResult } from './s3/types'
export { StorageRevisionConflictError, StorageUnavailableError } from './errors'
export {
  DEFAULT_STORAGE_PROFILE,
  sameStorageDocument,
  sameStorageLocation,
  storageLocationOf,
  storageProfileId
} from './location'
export {
  createActiveStorageAdapter,
  createStorageAdapter,
  openStorageAdapter,
  resetStorageProviderRegistryForTests,
  isStorageConfigured,
  storageCredentialRefs,
  storageCredentialStatuses
} from './runtime'
export type {
  StorageAdapter,
  StorageAdapterContext,
  StorageConnectionResult,
  StorageCredentialField,
  StorageDocument,
  StorageDocumentBinding,
  StorageDocumentContent,
  StorageLocation,
  StoragePutOptions,
  StoragePutResult,
  StorageDocumentMetadata,
  StorageFieldID,
  LibraryObjectStore,
  LibraryObjectSummary,
  LibraryObjectValue,
  LibraryObjectWriteOptions,
  StoragePreferenceField,
  StorageProviderID,
  StorageProviderRegistration,
  StorageProviderRuntime,
  StorageTransferProgress,
  StorageUsage
} from './types'
