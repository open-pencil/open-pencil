import type { StorageProviderRuntime } from '@/app/integrations/storage/types'

import { normalizeEndpoint } from '../s3/client'
import type { S3CompatibleConfig } from '../s3/types'

export const R2_ENDPOINT_FIELD = 'endpoint'
export const R2_BUCKET_FIELD = 'bucket'
export const R2_ACCESS_KEY_ID_FIELD = 'access-key-id'
export const R2_SECRET_ACCESS_KEY_FIELD = 'secret-access-key'

const R2_ENDPOINT_GUIDANCE =
  'Use the S3 API endpoint from your R2 bucket settings, such as https://<account-id>.r2.cloudflarestorage.com.'

/**
 * R2 has no regions: every request signs as `auto` and the account lives in the
 * hostname. `inferS3Region` already maps r2.cloudflarestorage.com to this, but
 * naming it here keeps the adapter readable without chasing the inference.
 */
const R2_REGION = 'auto'

const R2_HOST_PATTERN = /^([0-9a-f]{32})\.r2\.cloudflarestorage\.com$/

function requiredPreference(runtime: StorageProviderRuntime, field: string): string {
  const value = runtime.preferences[field]?.trim()
  if (!value) throw new Error(`Cloudflare R2 ${field} is required`)
  return value
}

/**
 * Cloudflare's dashboard presents the endpoint with the bucket already appended
 * (`https://<account>.r2.cloudflarestorage.com/<bucket>`), so a pasted value
 * usually carries exactly one path segment. Accept that and keep the origin:
 * rejecting it would reject the single most likely thing a user pastes.
 *
 * Anything beyond one segment is a different URL than the one being asked for
 * and is refused rather than silently truncated.
 */
export function normalizeR2Endpoint(endpoint: string): { endpoint: string; accountId: string } {
  const normalized = normalizeEndpoint(endpoint)
  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    throw new Error(R2_ENDPOINT_GUIDANCE)
  }

  const accountId = url.hostname.toLowerCase().match(R2_HOST_PATTERN)?.[1]
  const segments = url.pathname.split('/').filter(Boolean)
  if (
    !accountId ||
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    segments.length > 1 ||
    url.search ||
    url.hash
  ) {
    throw new Error(R2_ENDPOINT_GUIDANCE)
  }

  return { endpoint: url.origin, accountId }
}

export async function resolveR2S3Config(
  runtime: StorageProviderRuntime
): Promise<S3CompatibleConfig> {
  const bucket = requiredPreference(runtime, R2_BUCKET_FIELD)
  const { endpoint } = normalizeR2Endpoint(requiredPreference(runtime, R2_ENDPOINT_FIELD))
  const [accessKeyId, secretAccessKey] = await Promise.all([
    runtime.resolveCredential(R2_ACCESS_KEY_ID_FIELD),
    runtime.resolveCredential(R2_SECRET_ACCESS_KEY_FIELD)
  ])
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Cloudflare R2 access key ID and secret access key are required')
  }

  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region: R2_REGION
  }
}
