import { useLocalStorage } from '@vueuse/core'

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

export function writeStoragePreferenceUnchecked(
  providerID: StorageProviderID,
  field: StorageFieldID,
  value: string
): void {
  storedPreferences.value = {
    ...storedPreferences.value,
    [providerID]: {
      ...storedPreferences.value[providerID],
      [field]: value.trim()
    }
  }
}
