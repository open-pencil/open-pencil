import {
  activeCloudConnectionProfile,
  listCloudConnectionProfiles
} from '@/app/cloud/instances/profiles'

import { activeStorageProviderID, readStoragePreferences } from './preferences'
import { createStorageAdapter } from './runtime'
import type { StorageDocumentBinding, StorageProviderID } from './types'

export class StorageBindingUnavailableError extends Error {
  override readonly name = 'StorageBindingUnavailableError'
}

/** Resolve once, before asynchronous work; selection must never retarget a bound document. */
export function storagePreferencesForBinding(
  binding: StorageDocumentBinding
): Readonly<Record<string, string>> {
  if (binding.providerId !== 'openpencil-cloud')
    return { ...readStoragePreferences(binding.providerId) }
  const profile = listCloudConnectionProfiles().find(
    (candidate) => candidate.id === binding.connectionId
  )
  if (!profile || !binding.workspaceId)
    throw new StorageBindingUnavailableError('Cloud document connection is unavailable')
  return { 'server-url': profile.serverURL, 'workspace-id': binding.workspaceId }
}

export function createBoundStorageAdapter(binding: StorageDocumentBinding) {
  return createStorageAdapter(
    binding.providerId,
    storagePreferencesForBinding(binding),
    binding.connectionId
  )
}

/** Selection supplies defaults only for an unbound document being opened. */
export function selectedStorageBinding(
  documentId: string,
  providerId: StorageProviderID = activeStorageProviderID.value
): StorageDocumentBinding {
  if (providerId !== 'openpencil-cloud') return { providerId, documentId }
  // Read through the profile registry rather than mirrored provider preferences.
  const profile = activeCloudConnectionProfile()
  if (!profile?.selectedWorkspaceId)
    throw new Error('OpenPencil Cloud connection and workspace are required')
  return {
    providerId: 'openpencil-cloud',
    connectionId: profile.id,
    workspaceId: profile.selectedWorkspaceId,
    documentId
  }
}
