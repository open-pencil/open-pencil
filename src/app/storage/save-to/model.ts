import { storageProfileId, type StorageLocation } from '@/app/integrations/storage'

/** A place Save to can put a document: a Cloud workspace or the storage bucket. */
export type SaveDestination = {
  /** Tells destinations apart, as the dialog's choice. */
  key: string
  location: StorageLocation
  /** What the person picks, such as a workspace's or the bucket's name. */
  label: string
  kind: 'workspace' | 'bucket'
  /** The server it is on, which the dialog groups by; the bucket has none. */
  place: { id: string; label: string } | null
  /** The person's role where it varies; a viewer is shown the place but cannot save there. */
  role?: 'viewer' | 'editor' | 'admin'
}

/** The dialog's key for a location: the provider, then the profile and container it names. */
export function saveDestinationKey(location: StorageLocation): string {
  return [location.providerId, storageProfileId(location), location.containerId ?? ''].join('/')
}

export function canSaveTo(destination: SaveDestination): boolean {
  return destination.role !== 'viewer'
}

/** Why a save did not reach its destination. */
export type SaveFailure =
  | { reason: 'too-large'; limitBytes: number }
  | { reason: 'offline' | 'quota' | 'unavailable' }

export type SaveToState =
  | { kind: 'ready' }
  | { kind: 'saving'; sentBytes: number; totalBytes: number }
  | ({ kind: 'error' } & SaveFailure)
