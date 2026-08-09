import type { StorageProviderRuntime } from '@/app/integrations/storage/types'

import { normalizeEndpoint } from '../s3/client'
import { inferBunnyS3Region } from '../s3/region'
import type { S3CompatibleConfig } from '../s3/types'

export const BUNNY_ENDPOINT_FIELD = 'endpoint'
export const BUNNY_STORAGE_ZONE_FIELD = 'storage-zone'
export const BUNNY_PASSWORD_FIELD = 'password'

function requiredPreference(runtime: StorageProviderRuntime, field: string): string {
  const value = runtime.preferences[field]?.trim()
  if (!value) throw new Error(`Bunny ${field} is required`)
  return value
}

function normalizeBunnyS3Endpoint(endpoint: string): { endpoint: string; region: string } {
  const normalized = normalizeEndpoint(endpoint)
  const url = new URL(normalized)
  const region = inferBunnyS3Region(normalized)
  if (
    !region ||
    url.protocol !== 'https:' ||
    (url.pathname !== '' && url.pathname !== '/') ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'Use the Bunny S3 endpoint from the Storage Zone Access tab, such as https://de-s3.storage.bunnycdn.com.'
    )
  }
  return { endpoint: url.origin, region }
}

export async function resolveBunnyS3Config(
  runtime: StorageProviderRuntime
): Promise<S3CompatibleConfig> {
  const storageZone = requiredPreference(runtime, BUNNY_STORAGE_ZONE_FIELD)
  const resolvedEndpoint = normalizeBunnyS3Endpoint(
    requiredPreference(runtime, BUNNY_ENDPOINT_FIELD)
  )
  const password = await runtime.resolveCredential(BUNNY_PASSWORD_FIELD)
  if (!password) throw new Error('Bunny Storage Zone password is required')

  return {
    endpoint: resolvedEndpoint.endpoint,
    bucket: storageZone,
    accessKeyId: storageZone,
    secretAccessKey: password,
    region: resolvedEndpoint.region
  }
}
