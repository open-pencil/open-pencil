import { appCredentialServices } from '@/app/settings/credentials/app'
import { credentialRef } from '@/app/settings/credentials/reference'
import type { CredentialRef, CredentialStatus } from '@/app/settings/credentials/types'

import {
  activeStorageProviderID,
  readStoragePreferences,
  storagePreferencesComplete
} from './preferences'
import { storageProviderRegistry } from './providers'
import type { StorageAdapter, StorageProviderID } from './types'

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
