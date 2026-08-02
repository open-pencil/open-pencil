import type { StorageProviderRuntime } from '../types'

export const APPWRITE_ENDPOINT_FIELD = 'endpoint'
export const APPWRITE_PROJECT_ID_FIELD = 'project-id'
export const APPWRITE_BUCKET_ID_FIELD = 'bucket-id'
export const APPWRITE_API_KEY_FIELD = 'api-key'

export type AppwriteConfig = {
  endpoint: string
  projectId: string
  bucketId: string | null
  apiKey: string
}

function requiredPreference(runtime: StorageProviderRuntime, field: string): string {
  const value = runtime.preferences[field]?.trim()
  if (!value) throw new Error(`Appwrite ${field} is required`)
  return value
}

export function normalizeAppwriteEndpoint(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('Appwrite endpoint is required')

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error('Appwrite endpoint must be a valid URL')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Appwrite endpoint must use HTTP or HTTPS')
  }
  if (url.search || url.hash) throw new Error('Appwrite endpoint cannot contain a query or hash')

  const pathname = url.pathname.replace(/\/+$/, '')
  if (!pathname.endsWith('/v1')) throw new Error('Appwrite endpoint must end in /v1')
  return `${url.origin}${pathname}`
}

export async function resolveAppwriteConfig(
  runtime: StorageProviderRuntime
): Promise<AppwriteConfig> {
  const apiKey = await runtime.resolveCredential(APPWRITE_API_KEY_FIELD)
  if (!apiKey) throw new Error('Appwrite API key is required')

  return {
    endpoint: normalizeAppwriteEndpoint(requiredPreference(runtime, APPWRITE_ENDPOINT_FIELD)),
    projectId: requiredPreference(runtime, APPWRITE_PROJECT_ID_FIELD),
    bucketId: runtime.preferences[APPWRITE_BUCKET_ID_FIELD]?.trim() || null,
    apiKey
  }
}
