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
  /**
   * Whether anyone may open what is saved there, as in a server's community gallery: Save to
   * never picks it on its own, and says so when it is chosen.
   */
  public?: boolean
}

/** The dialog's key for a location: the provider, then the profile and container it names. */
export function saveDestinationKey(location: StorageLocation): string {
  return [location.providerId, storageProfileId(location), location.containerId ?? ''].join('/')
}

export function canSaveTo(destination: SaveDestination): boolean {
  return destination.role !== 'viewer'
}

/**
 * Where Save to starts: the place saved to last, else the first the person can save to, and
 * whether to ask before saving. A public place is never picked on its own, so publishing is
 * always chosen; with only that place, nothing is chosen until the person picks it. With one
 * place that is not public, Save to saves without asking.
 */
export function initialSaveChoice(
  destinations: SaveDestination[],
  lastKey: string
): { chosen: string; ask: boolean } {
  const writable = destinations.filter(canSaveTo)
  const own = writable.filter((destination) => !destination.public)
  const first = own.find((destination) => destination.key === lastKey) ?? own.at(0)
  return { chosen: first?.key ?? '', ask: writable.length > 1 || !first }
}

/** Why a save did not reach its destination. */
export type SaveFailure =
  | { reason: 'too-large'; limitBytes: number }
  | { reason: 'offline' | 'quota' | 'unavailable' }

export type SaveToState =
  | { kind: 'ready' }
  | { kind: 'saving'; sentBytes: number; totalBytes: number }
  | ({ kind: 'error' } & SaveFailure)
