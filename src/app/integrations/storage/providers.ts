import { CLOUD_SESSION_FIELD, CLOUD_STORAGE_PROVIDER_ID } from '@/app/cloud/sessions/token'

import { createCloudStorageAdapter } from './cloud/adapter'
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

/** Servers are profiles and workspaces containers; signing in replaces typed credentials. */
export const CLOUD_STORAGE_PROVIDER = defineStorageProvider({
  id: CLOUD_STORAGE_PROVIDER_ID,
  label: 'OpenPencil Cloud',
  description: 'Workspaces on OpenPencil Cloud or your team’s own server',
  preferenceFields: [],
  credentialFields: [{ id: CLOUD_SESSION_FIELD, label: 'Session' }],
  createAdapter: (runtime) => createCloudStorageAdapter(runtime)
})

export const storageProviderRegistry = new StorageProviderRegistry([
  S3_STORAGE_PROVIDER,
  CLOUD_STORAGE_PROVIDER
])
