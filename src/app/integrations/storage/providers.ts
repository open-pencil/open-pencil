import bunnyLogoUrl from '@/assets/logo-bunnynet-icon.svg'

import { createBunnyStorageAdapter } from './bunny/adapter'
import {
  BUNNY_ENDPOINT_FIELD,
  BUNNY_PASSWORD_FIELD,
  BUNNY_STORAGE_ZONE_FIELD
} from './bunny/config'
import { defineStorageProvider, StorageProviderRegistry } from './registry'
import { createS3StorageAdapter } from './s3/adapter'

export const BUNNY_STORAGE_PROVIDER = defineStorageProvider({
  id: 'bunny-storage',
  label: 'Bunny Storage',
  icon: bunnyLogoUrl,
  description:
    'Create a Bunny Storage Zone with S3 Compatibility enabled, then copy its zone name, S3 endpoint, and password. No CORS setup is needed.',
  preferenceFields: [
    {
      id: BUNNY_STORAGE_ZONE_FIELD,
      label: 'Storage Zone name',
      kind: 'text',
      required: true,
      placeholder: 'your-storage-zone'
    },
    {
      id: BUNNY_ENDPOINT_FIELD,
      label: 'S3 endpoint',
      kind: 'url',
      required: true,
      placeholder: 'https://de-s3.storage.bunnycdn.com'
    }
  ],
  credentialFields: [
    {
      id: BUNNY_PASSWORD_FIELD,
      label: 'Storage Zone password',
      required: true
    }
  ],
  createAdapter: createBunnyStorageAdapter
})

export const S3_STORAGE_PROVIDER = defineStorageProvider({
  id: 's3-compatible',
  label: 'S3 compatible',
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
  BUNNY_STORAGE_PROVIDER,
  S3_STORAGE_PROVIDER
])
