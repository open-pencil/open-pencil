import {
  readStoragePreferences,
  storageProviderRegistry,
  type StorageProviderID
} from '@/app/integrations/storage'

/**
 * FNV-1a, 32-bit: a lookup key over a few short configuration strings, not a secret. A collision
 * would need two buckets of one provider to hash equal.
 */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/**
 * Where a provider's designs sync to now: the provider and its non-secret configuration
 * (endpoint, bucket, region), or null while it is not configured enough to name one.
 * Derived rather than generated, so returning to a bucket used before names it again, and a
 * row's sync state is recognised as belonging to it.
 */
export function currentStorageDestination(providerId: StorageProviderID): string | null {
  const provider = storageProviderRegistry.get(providerId)
  const preferences = readStoragePreferences(providerId)
  const fields = provider.preferenceFields
    .map((field) => ({ field, value: preferences[field.id]?.trim() ?? '' }))
    .filter(({ value }) => value !== '')
  if (provider.preferenceFields.some((field) => field.required && !preferences[field.id]?.trim())) {
    return null
  }
  const canonical = fields
    .map(({ field, value }) => `${field.id}=${value}`)
    .sort()
    .join('\u0000')
  return `${providerId}#${fnv1a(canonical)}`
}
