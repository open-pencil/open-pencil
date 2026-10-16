import { useLocalStorage } from '@vueuse/core'

import { storageProviderRegistry } from './providers'
import type { StorageFieldID, StorageProviderID } from './types'

export type StoragePreferences = Record<StorageProviderID, Record<StorageFieldID, string>>

export const activeStorageProviderID = useLocalStorage<StorageProviderID>(
  'open-pencil:storage:provider',
  's3-compatible'
)

const storedPreferences = useLocalStorage<StoragePreferences>('open-pencil:storage:preferences', {})

/** Build-time storage defaults: only an address and a bucket, never keys. */
export interface StoragePresetEnv {
  readonly VITE_STORAGE_PRESET_ENDPOINT?: string
  readonly VITE_STORAGE_PRESET_BUCKET?: string
}

/** The S3-compatible endpoint and bucket a self-hosted build fills in, when it sets both. */
export function storagePreset(env: StoragePresetEnv): Partial<StoragePreferences> {
  const endpoint = env.VITE_STORAGE_PRESET_ENDPOINT?.trim()
  const bucket = env.VITE_STORAGE_PRESET_BUCKET?.trim()
  if (!endpoint || !bucket) return {}
  return { 's3-compatible': { endpoint, bucket } }
}

/** Saved values win; a preset only fills fields that are missing or empty. */
export function withPreset(
  saved: Readonly<Record<StorageFieldID, string>> | undefined,
  preset: Readonly<Record<StorageFieldID, string>> | undefined
): Record<StorageFieldID, string> {
  const filled = Object.entries(saved ?? {}).filter(([, value]) => value.trim() !== '')
  return { ...preset, ...Object.fromEntries(filled) }
}

const preset = storagePreset(import.meta.env)

export function readStoragePreferences(
  providerID: StorageProviderID
): Readonly<Record<StorageFieldID, string>> {
  return withPreset(storedPreferences.value[providerID], preset[providerID])
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
