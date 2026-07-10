import { createS3CompatibleAdapter } from '@/app/cloud/s3/adapter'
import type {
  CloudProviderDef,
  CloudProviderId,
  CloudStorageAdapter,
  S3CompatibleConfig
} from '@/app/cloud/types'

const S3_PROVIDER: CloudProviderDef = {
  id: 's3-compatible',
  label: 'S3 compatible',
  description: 'AWS S3, Backblaze B2, Cloudflare R2, MinIO, and other S3-compatible buckets'
}

export const CLOUD_PROVIDERS: CloudProviderDef[] = [S3_PROVIDER]

// S3-compatible is the only provider today; branch on id when a second one lands.
export function getCloudProviderDef(_id: CloudProviderId): CloudProviderDef {
  return S3_PROVIDER
}

export function createCloudAdapter(
  _providerId: CloudProviderId,
  s3Config: S3CompatibleConfig
): CloudStorageAdapter {
  return createS3CompatibleAdapter(s3Config)
}
