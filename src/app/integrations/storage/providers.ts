import appwriteLogoUrl from '@/assets/appwrite-logo.svg'
import backblazeLogoUrl from '@/assets/backblaze-logo.svg'
import bucketIconUrl from '@/assets/bucket.svg'
import cloudflareLogoUrl from '@/assets/cloudflare-logo.svg'
import bunnyLogoUrl from '@/assets/logo-bunnynet-icon.svg'

import { createAppwriteStorageAdapter } from './appwrite/adapter'
import {
  APPWRITE_API_KEY_FIELD,
  APPWRITE_BUCKET_ID_FIELD,
  APPWRITE_ENDPOINT_FIELD,
  APPWRITE_PROJECT_ID_FIELD
} from './appwrite/config'
import { createBackblazeStorageAdapter } from './backblaze/adapter'
import {
  BACKBLAZE_APPLICATION_KEY_FIELD,
  BACKBLAZE_APPLICATION_KEY_ID_FIELD,
  BACKBLAZE_BUCKET_FIELD,
  BACKBLAZE_ENDPOINT_FIELD
} from './backblaze/config'
import { createBunnyStorageAdapter } from './bunny/adapter'
import {
  BUNNY_ENDPOINT_FIELD,
  BUNNY_PASSWORD_FIELD,
  BUNNY_STORAGE_ZONE_FIELD
} from './bunny/config'
import { createR2StorageAdapter } from './r2/adapter'
import {
  R2_ACCESS_KEY_ID_FIELD,
  R2_BUCKET_FIELD,
  R2_ENDPOINT_FIELD,
  R2_SECRET_ACCESS_KEY_FIELD
} from './r2/config'
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
  conflictProtection: 'detect',
  createAdapter: createAppwriteStorageAdapter
})

export const BUNNY_STORAGE_PROVIDER = defineStorageProvider({
  id: 'bunny-storage',
  // Vendor pages disagree on maturity ("public preview" vs "beta") — stay conservative.
  label: 'Bunny Storage (S3 beta)',
  icon: bunnyLogoUrl,
  description:
    'Create a Bunny Storage Zone with S3 Compatibility enabled (a Bunny preview feature), then copy its zone name, S3 endpoint, and password. No CORS setup is needed.',
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
  conflictProtection: 'detect',
  createAdapter: createBunnyStorageAdapter
})

export const BACKBLAZE_STORAGE_PROVIDER = defineStorageProvider({
  id: 'backblaze-b2',
  label: 'Backblaze B2 (S3)',
  icon: backblazeLogoUrl,
  description:
    'Create a B2 bucket and a bucket-scoped application key with list, read, write, and delete access, then copy the bucket name and S3 endpoint shown by Backblaze. Browser use requires bucket CORS configuration.',
  helpUrl: 'https://secure.backblaze.com/b2_buckets.htm',
  helpLabel: 'Open Backblaze B2',
  corsConfiguration: 's3',
  preferenceFields: [
    {
      id: BACKBLAZE_BUCKET_FIELD,
      label: 'Bucket',
      kind: 'text',
      required: true,
      placeholder: 'your-b2-bucket'
    },
    {
      id: BACKBLAZE_ENDPOINT_FIELD,
      label: 'S3 endpoint',
      kind: 'url',
      required: true,
      placeholder: 'https://s3.us-west-004.backblazeb2.com'
    }
  ],
  credentialFields: [
    {
      id: BACKBLAZE_APPLICATION_KEY_ID_FIELD,
      label: 'Application key ID',
      required: true
    },
    {
      id: BACKBLAZE_APPLICATION_KEY_FIELD,
      label: 'Application key',
      required: true
    }
  ],
  conflictProtection: 'detect',
  createAdapter: createBackblazeStorageAdapter
})

export const R2_STORAGE_PROVIDER = defineStorageProvider({
  id: 'cloudflare-r2',
  label: 'Cloudflare R2',
  icon: cloudflareLogoUrl,
  description:
    'Create an R2 bucket and an R2 API token with Object Read & Write, then copy the bucket name and the S3 API endpoint from the bucket settings. Browser use requires adding a CORS policy to the bucket.',
  helpUrl: 'https://dash.cloudflare.com/?to=/:account/r2/overview',
  helpLabel: 'Open the R2 dashboard',
  pricingNote: '10 GB stored free per month, and no egress fees.',
  corsConfiguration: 's3',
  preferenceFields: [
    {
      id: R2_BUCKET_FIELD,
      label: 'Bucket',
      kind: 'text',
      required: true,
      placeholder: 'openpencil-r2'
    },
    {
      id: R2_ENDPOINT_FIELD,
      label: 'S3 API endpoint',
      kind: 'url',
      required: true,
      placeholder: 'https://<account-id>.r2.cloudflarestorage.com'
    }
  ],
  credentialFields: [
    { id: R2_ACCESS_KEY_ID_FIELD, label: 'Access key ID', required: true },
    { id: R2_SECRET_ACCESS_KEY_FIELD, label: 'Secret access key', required: true }
  ],
  // R2 is the first provider able to PREVENT a clobbering write rather than
  // only detect one: the live probe (scratch/b2-cas-probe.sh, 2026-08-04)
  // confirmed 412 PreconditionFailed on a stale If-Match and on
  // If-None-Match '*', so the conditional head update ships enabled.
  conflictProtection: 'prevent',
  createAdapter: createR2StorageAdapter
})

export const S3_STORAGE_PROVIDER = defineStorageProvider({
  id: 's3-compatible',
  label: 'Generic S3',
  // A bucket rather than a brand: this entry is every S3-compatible service at
  // once, so no vendor mark would be honest. Sat iconless next to three logos.
  icon: bucketIconUrl,
  description:
    'AWS S3, Cloudflare R2, MinIO, and other compatible storage. Requires adding a CORS configuration to your bucket.',
  corsConfiguration: 's3',
  catchAll: true,
  preferenceFields: [
    { id: 'endpoint', label: 'Endpoint', kind: 'url', required: true },
    { id: 'bucket', label: 'Bucket', kind: 'text', required: true },
    { id: 'region', label: 'Region', kind: 'text' }
  ],
  credentialFields: [
    { id: 'access-key-id', label: 'Access key ID', required: true },
    { id: 'secret-access-key', label: 'Secret access key', required: true }
  ],
  conflictProtection: 'detect',
  createAdapter: createS3StorageAdapter
})

export const storageProviderRegistry = new StorageProviderRegistry([
  APPWRITE_STORAGE_PROVIDER,
  BUNNY_STORAGE_PROVIDER,
  BACKBLAZE_STORAGE_PROVIDER,
  R2_STORAGE_PROVIDER,
  S3_STORAGE_PROVIDER
])
