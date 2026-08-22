import { i18n } from '#vue/i18n/create'

export const storageMessageDefaults = {
  storageWorkspace: 'Storage workspace',
  openStorageWorkspace: 'Open workspace',
  newStoredDocument: 'New document',
  emptyStorageWorkspace: 'No stored documents yet.',
  loadingDocuments: 'Loading documents…',
  storageNotConfigured: 'Configure storage before using this workspace.',
  storageProviderS3: 'S3 storage',
  storageProviderR2: 'Cloudflare R2',
  storageProviderAmazonS3: 'Amazon S3',
  storageProviderBackblaze: 'Backblaze B2',
  loadingStorageWorkspace: 'Loading storage workspace…',
  copyStorageCors: 'Copy CORS JSON',
  storageEndpoint: 'Endpoint',
  storageBucket: 'Bucket',
  storageRegion: 'Region',
  storageAccessKeyID: 'Access key ID',
  storageSecretAccessKey: 'Secret access key'
} as const

export const storageMessages = i18n('storage', storageMessageDefaults)
