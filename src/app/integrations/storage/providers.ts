import { CLOUD_STORAGE_PROVIDERS } from '@/app/cloud/integration/storage'

import {
  createGoogleDriveStorageAdapter,
  DRIVE_CLIENT_ID_FIELD,
  DRIVE_FOLDER_FIELD
} from './google-drive/adapter'
import { defineStorageProvider, StorageProviderRegistry } from './registry'
import { createS3StorageAdapter } from './s3/adapter'

export const S3_STORAGE_PROVIDER = defineStorageProvider({
  id: 's3-compatible',
  label: 'S3 storage',
  description: 'AWS S3, Backblaze B2, Cloudflare R2, MinIO, and compatible storage',
  preferenceFields: [
    { id: 'endpoint', label: 'Endpoint', kind: 'url', required: true },
    { id: 'bucket', label: 'Bucket', kind: 'text', required: true },
    { id: 'region', label: 'Region', kind: 'text' }
  ],
  credentialFields: [
    { id: 'access-key-id', label: 'Access key ID', required: true },
    { id: 'secret-access-key', label: 'Secret access key', required: true }
  ],
  createAdapter: createS3StorageAdapter
})

export const GOOGLE_DRIVE_STORAGE_PROVIDER = defineStorageProvider({
  id: 'google-drive',
  label: 'Google Drive',
  description: 'Your own Google Drive: documents sync between the browser, desktop and phone',
  preferenceFields: [
    {
      id: DRIVE_CLIENT_ID_FIELD,
      label: 'Google OAuth client ID',
      kind: 'text',
      required: true,
      placeholder: '…apps.googleusercontent.com'
    },
    { id: DRIVE_FOLDER_FIELD, label: 'Folder', kind: 'text', placeholder: 'Lawha' }
  ],
  credentialFields: [],
  createAdapter: createGoogleDriveStorageAdapter
})

export const storageProviderRegistry = new StorageProviderRegistry([
  GOOGLE_DRIVE_STORAGE_PROVIDER,
  S3_STORAGE_PROVIDER,
  ...CLOUD_STORAGE_PROVIDERS
])
