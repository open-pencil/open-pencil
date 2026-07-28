import { useLocalStorage } from '@vueuse/core'

import { storageProviderRegistry } from './providers'
import type { StorageFieldID, StorageProviderID } from './types'

export type StoragePreferences = Record<StorageProviderID, Record<StorageFieldID, string>>

export const activeStorageProviderID = useLocalStorage<StorageProviderID>(
  'open-pencil:storage:provider',
  's3-compatible'
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
