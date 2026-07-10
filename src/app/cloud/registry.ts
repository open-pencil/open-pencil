import { createS3CompatibleAdapter } from '@/app/cloud/s3/adapter'
import type {
  CloudProviderDef,
  CloudProviderId,
  CloudStorageAdapter,
  S3CompatibleConfig
} from '@/app/cloud/types'

export const CLOUD_PROVIDERS: CloudProviderDef[] = [
  {
    id: 's3-compatible',
    label: 'S3 compatible',
    description: 'AWS S3, Backblaze B2, Cloudflare R2, MinIO, and other S3-compatible buckets'
  }
]

export function getCloudProviderDef(id: CloudProviderId): CloudProviderDef {
  return CLOUD_PROVIDERS.find((p) => p.id === id) ?? CLOUD_PROVIDERS[0]
}

export function createCloudAdapter(
  providerId: CloudProviderId,
  s3Config: S3CompatibleConfig
): CloudStorageAdapter {
  if (providerId === 's3-compatible') {
    return createS3CompatibleAdapter(s3Config)
  }
  throw new Error(`Unknown cloud storage provider: ${providerId}`)
}
