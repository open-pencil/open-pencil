import {
  activeStorageProviderID,
  readStoragePreferences,
  writeStoragePreferenceUnchecked,
  type StoragePreferences
} from './preference-store'
import { storageProviderRegistry } from './providers'
import type { StorageFieldID, StorageProviderID } from './types'

export { activeStorageProviderID, readStoragePreferences, type StoragePreferences }

export function writeStoragePreference(
  providerID: StorageProviderID,
  field: StorageFieldID,
  value: string
): void {
  const provider = storageProviderRegistry.get(providerID)
  if (!provider.preferenceFields.some((definition) => definition.id === field)) {
    throw new Error(`Unknown preference field for ${providerID}: ${field}`)
  }
  writeStoragePreferenceUnchecked(providerID, field, value)
}

export function storagePreferencesComplete(providerID: StorageProviderID): boolean {
  const provider = storageProviderRegistry.get(providerID)
  const preferences = readStoragePreferences(providerID)
  return provider.preferenceFields.every(
    (field) => !field.required || Boolean(preferences[field.id]?.trim())
  )
}
