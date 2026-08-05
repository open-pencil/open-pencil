import { useLocalStorage } from '@vueuse/core'

import { storageProviderRegistry } from './providers'
import { asStorageProviderID, type StorageFieldID, type StorageProviderID } from './types'

export type StoragePreferences = Record<StorageProviderID, Record<StorageFieldID, string>>

export const activeStorageProviderID = useLocalStorage<StorageProviderID>(
  'open-pencil:storage:provider',
  asStorageProviderID('s3-compatible')
)

const storedPreferences = useLocalStorage<StoragePreferences>('open-pencil:storage:preferences', {})

export function readStoragePreferences(
  providerID: StorageProviderID
): Readonly<Record<StorageFieldID, string>> {
  return { ...storedPreferences.value[providerID] }
}

export function writeStoragePreference(
  providerID: StorageProviderID,
  field: StorageFieldID,
  value: string
): void {
  const provider = storageProviderRegistry.get(providerID)
  if (!provider.preferenceFields.some((definition) => definition.id === field)) {
    throw new Error(`Unknown preference field for ${providerID}: ${field}`)
  }
  storedPreferences.value = {
    ...storedPreferences.value,
    [providerID]: {
      ...storedPreferences.value[providerID],
      [field]: value.trim()
    }
  }
}

export function storagePreferencesComplete(providerID: StorageProviderID): boolean {
  const provider = storageProviderRegistry.get(providerID)
  const preferences = readStoragePreferences(providerID)
  return provider.preferenceFields.every(
    (field) => !field.required || Boolean(preferences[field.id]?.trim())
  )
}

/**
 * Provider configuration safe to put in a bug report.
 *
 * Allowlist by classification, not by shape: a field is included only if the
 * provider did not mark it `secret`. Empty values are dropped — an unset
 * endpoint is noise, and its absence is already visible in the error.
 */
export function nonSecretProviderContext(providerID: StorageProviderID): Record<string, string> {
  const provider = storageProviderRegistry.get(providerID)
  const preferences = readStoragePreferences(providerID)
  const context: Record<string, string> = {}
  for (const field of provider.preferenceFields) {
    if (field.secret) continue
    const value = preferences[field.id]
    if (value) context[field.label] = value
  }
  return context
}
