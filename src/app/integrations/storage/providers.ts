import { createCloudStorageAdapter } from './cloud/adapter'
import { defineStorageProvider, StorageProviderRegistry } from './registry'
import { createS3StorageAdapter } from './s3/adapter'

export const OPENPENCIL_CLOUD_PROVIDER = defineStorageProvider({
  id: 'openpencil-cloud',
  label: 'OpenPencil Cloud',
  description: 'Official or self-hosted OpenPencil Cloud workspace',
  preferenceFields: [
    { id: 'server-url', label: 'Server URL', kind: 'url', required: true },
    { id: 'workspace-id', label: 'Workspace ID', kind: 'text', required: true }
  ],
  credentialFields: [],
  createAdapter: createCloudStorageAdapter
})

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

export const storageProviderRegistry = new StorageProviderRegistry([
  OPENPENCIL_CLOUD_PROVIDER,
  S3_STORAGE_PROVIDER
])
