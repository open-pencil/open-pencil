import { appCredentialServices } from '@/app/settings/credentials/app'
import { credentialRef } from '@/app/settings/credentials/reference'
import type { CredentialRef, CredentialStatus } from '@/app/settings/credentials/types'

import { StorageUnavailableError } from './errors'
import { storageProfileId } from './location'
import {
  activeStorageProviderID,
  readStoragePreferences,
  storagePreferencesComplete
} from './preferences'
import { storageProviderRegistry } from './providers'
import type { StorageProviderRegistry } from './registry'
import type { StorageAdapter, StorageLocation, StorageProviderID } from './types'

export function storageCredentialRefs(
  providerID: StorageProviderID,
  profileID = 'default'
): CredentialRef[] {
  return storageProviderRegistry
    .get(providerID)
    .credentialFields.map((field) => credentialRef(providerID, field.id, profileID))
}

export async function storageCredentialStatuses(
  providerID: StorageProviderID,
  profileID = 'default'
): Promise<Record<string, CredentialStatus>> {
  const provider = storageProviderRegistry.get(providerID)
  const entries = await Promise.all(
    provider.credentialFields.map(async (field) => {
      const status = await appCredentialServices.manager.status(
        credentialRef(providerID, field.id, profileID)
      )
      return [field.id, status] as const
    })
  )
  return Object.fromEntries(entries)
}

/** Required preferences are filled in and every required credential is saved. */
export async function isStorageConfigured(providerID: StorageProviderID): Promise<boolean> {
  if (!storagePreferencesComplete(providerID)) return false
  const statuses = await storageCredentialStatuses(providerID)
  return storageProviderRegistry
    .get(providerID)
    .credentialFields.every((field) => !field.required || statuses[field.id] === 'configured')
}

export function createActiveStorageAdapter(
  providerID: StorageProviderID = activeStorageProviderID.value,
  profileID = 'default'
): StorageAdapter {
  return storageProviderRegistry.createAdapter(providerID, {
    preferences: readStoragePreferences(providerID),
    credentials: appCredentialServices.resolver,
    profileId: profileID
  })
}

let registry: StorageProviderRegistry = storageProviderRegistry

/** Swaps the registered providers, so tests can supply an in-memory one. */
export function resetStorageProviderRegistryForTests(replacement?: StorageProviderRegistry) {
  registry = replacement ?? storageProviderRegistry
}

/** An adapter for one location: its provider, profile, and container. */
export function createStorageAdapter(location: StorageLocation): StorageAdapter {
  return registry.createAdapter(location.providerId, {
    preferences: readStoragePreferences(location.providerId),
    credentials: appCredentialServices.resolver,
    profileId: storageProfileId(location),
    containerId: location.containerId
  })
}

/**
 * An adapter for a location that is ready to use, for background work. Throws
 * `StorageUnavailableError` while the location still needs settings or credentials; providers
 * that sign in rather than store fields throw it from their own calls.
 */
export async function openStorageAdapter(location: StorageLocation): Promise<StorageAdapter> {
  const provider = registry.get(location.providerId)
  const required = provider.preferenceFields.filter((field) => field.required)
  const preferences = readStoragePreferences(location.providerId)
  if (required.some((field) => !preferences[field.id]?.trim())) {
    throw new StorageUnavailableError(`${provider.label} is not configured`)
  }
  const missing = await Promise.all(
    provider.credentialFields
      .filter((field) => field.required)
      .map(async (field) => {
        const ref = credentialRef(location.providerId, field.id, storageProfileId(location))
        return (await appCredentialServices.manager.status(ref)) !== 'configured'
      })
  )
  if (missing.includes(true)) {
    throw new StorageUnavailableError(`${provider.label} credentials are unavailable`)
  }
  return createStorageAdapter(location)
}
