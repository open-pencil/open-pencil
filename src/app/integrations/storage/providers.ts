import appwriteLogoUrl from '@/assets/appwrite-logo.svg'
import bunnyLogoUrl from '@/assets/logo-bunnynet-icon.svg'

import { createAppwriteStorageAdapter } from './appwrite/adapter'
import {
  APPWRITE_API_KEY_FIELD,
  APPWRITE_BUCKET_ID_FIELD,
  APPWRITE_ENDPOINT_FIELD,
  APPWRITE_PROJECT_ID_FIELD
} from './appwrite/config'
import { createBunnyStorageAdapter } from './bunny/adapter'
import {
  BUNNY_ENDPOINT_FIELD,
  BUNNY_PASSWORD_FIELD,
  BUNNY_STORAGE_ZONE_FIELD
} from './bunny/config'
import { defineStorageProvider, StorageProviderRegistry } from './registry'
import { createS3StorageAdapter } from './s3/adapter'

export const APPWRITE_STORAGE_PROVIDER = defineStorageProvider({
  id: 'appwrite-storage',
  label: 'Appwrite',
  icon: appwriteLogoUrl,
  description:
    'Create a bucket, give the Any role Create/Read/Update/Delete permissions on it, then enter its Bucket ID here along with an API key that has files read/write scopes.',
  helpUrl: 'https://cloud.appwrite.io/console',
  helpLabel: 'Open the Appwrite Console',
  pricingNote:
    'Enter the Bucket ID explicitly — browsers cannot list or create buckets, since those are admin-only operations.',
  preferenceFields: [
    {
      id: APPWRITE_ENDPOINT_FIELD,
      label: 'Endpoint',
      kind: 'url',
      required: true,
      placeholder: 'https://fra.cloud.appwrite.io/v1'
    },
    {
      id: APPWRITE_PROJECT_ID_FIELD,
      label: 'Project ID',
      kind: 'text',
      required: true
    },
    {
      id: APPWRITE_BUCKET_ID_FIELD,
      label: 'Bucket ID',
      kind: 'text',
      required: true,
      // An ID-shaped placeholder: entering the bucket's display name instead of
      // its generated ID produces a bare 404 and is the easiest mistake to make.
      placeholder: 'e.g. 6a1fb4370016b3e95de4 — the ID, not the bucket name'
    }
  ],
  credentialFields: [
    {
      id: APPWRITE_API_KEY_FIELD,
      label: 'API key',
      required: true
    }
  ],
  createAdapter: createAppwriteStorageAdapter
})

export const BUNNY_STORAGE_PROVIDER = defineStorageProvider({
  id: 'bunny-storage',
  label: 'Bunny Storage (S3)',
  icon: bunnyLogoUrl,
  description:
    'Create a Bunny Storage Zone with S3 Compatibility enabled, then copy its zone name, S3 endpoint, and password. No CORS setup is needed.',
  helpUrl: 'https://bunny.net/',
  helpLabel: 'Get your Storage Zone credentials',
  pricingNote: '14-day free trial, then $1/month for 100 GB. No API fees, free egress.',
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
  label: 'Generic S3',
  description:
    'AWS S3, Backblaze B2, Cloudflare R2, MinIO, and compatible storage. Requires adding a CORS configuration to your bucket.',
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
  APPWRITE_STORAGE_PROVIDER,
  BUNNY_STORAGE_PROVIDER,
  S3_STORAGE_PROVIDER
])
