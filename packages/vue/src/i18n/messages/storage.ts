import { i18n } from '#vue/i18n/create'

export const storageMessageDefaults = {
  workspace: 'Storage workspace',
  openWorkspace: 'Open workspace',
  newStoredDocument: 'New document',
  emptyStorageWorkspace: 'No stored documents yet.',
  loadingDocuments: 'Loading documents…',
  notConfigured: 'Configure storage before using this workspace.',
  providerS3: 'S3 storage',
  providerR2: 'Cloudflare R2',
  providerAmazonS3: 'Amazon S3',
  providerBackblaze: 'Backblaze B2',
  loadingWorkspace: 'Loading storage workspace…',
  copyCors: 'Copy CORS JSON',
  endpoint: 'Endpoint',
  bucket: 'Bucket',
  region: 'Region',
  accessKeyID: 'Access key ID',
  secretAccessKey: 'Secret access key'
} as const

export const storageMessages = i18n('storage', storageMessageDefaults)
