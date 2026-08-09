import type { StorageProviderRuntime } from '@/app/integrations/storage/types'

import { normalizeEndpoint } from '../s3/client'
import { inferBackblazeS3Region } from '../s3/region'
import type { S3CompatibleConfig } from '../s3/types'

export const BACKBLAZE_ENDPOINT_FIELD = 'endpoint'
export const BACKBLAZE_BUCKET_FIELD = 'bucket'
export const BACKBLAZE_APPLICATION_KEY_ID_FIELD = 'application-key-id'
export const BACKBLAZE_APPLICATION_KEY_FIELD = 'application-key'

const BACKBLAZE_ENDPOINT_GUIDANCE =
  'Use the Backblaze S3 endpoint shown for your bucket, such as https://s3.us-west-004.backblazeb2.com.'

function requiredPreference(runtime: StorageProviderRuntime, field: string): string {
  const value = runtime.preferences[field]?.trim()
  if (!value) throw new Error(`Backblaze ${field} is required`)
  return value
}

function normalizeBackblazeS3Endpoint(endpoint: string): { endpoint: string; region: string } {
  const normalized = normalizeEndpoint(endpoint)
  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    throw new Error(BACKBLAZE_ENDPOINT_GUIDANCE)
  }
  const region = inferBackblazeS3Region(normalized)
  if (
    !region ||
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    (url.pathname !== '' && url.pathname !== '/') ||
    url.search ||
    url.hash
  ) {
    throw new Error(BACKBLAZE_ENDPOINT_GUIDANCE)
  }
  return { endpoint: url.origin, region }
}

export async function resolveBackblazeS3Config(
  runtime: StorageProviderRuntime
): Promise<S3CompatibleConfig> {
  const bucket = requiredPreference(runtime, BACKBLAZE_BUCKET_FIELD)
  const resolvedEndpoint = normalizeBackblazeS3Endpoint(
    requiredPreference(runtime, BACKBLAZE_ENDPOINT_FIELD)
  )
  const [accessKeyId, secretAccessKey] = await Promise.all([
    runtime.resolveCredential(BACKBLAZE_APPLICATION_KEY_ID_FIELD),
    runtime.resolveCredential(BACKBLAZE_APPLICATION_KEY_FIELD)
  ])
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Backblaze application key ID and application key are required')
  }

  return {
    endpoint: resolvedEndpoint.endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region: resolvedEndpoint.region
  }
}
