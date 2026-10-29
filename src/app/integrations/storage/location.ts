import type { StorageDocumentBinding, StorageLocation } from './types'

export const DEFAULT_STORAGE_PROFILE = 'default'

export function storageProfileId(location: StorageLocation): string {
  return location.profileId ?? DEFAULT_STORAGE_PROFILE
}

export function sameStorageLocation(first: StorageLocation, second: StorageLocation): boolean {
  return (
    first.providerId === second.providerId &&
    storageProfileId(first) === storageProfileId(second) &&
    first.containerId === second.containerId
  )
}

export function sameStorageDocument(
  first: StorageDocumentBinding,
  second: StorageDocumentBinding
): boolean {
  return sameStorageLocation(first, second) && first.documentId === second.documentId
}

/** The location part of a binding or stored row, without its document. */
export function storageLocationOf(source: StorageLocation): StorageLocation {
  const location: StorageLocation = { providerId: source.providerId }
  if (source.profileId !== undefined) location.profileId = source.profileId
  if (source.containerId !== undefined) location.containerId = source.containerId
  return location
}
