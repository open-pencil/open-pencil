import { shallowRef } from 'vue'

import type { LocalLibraryCatalog } from '@/app/libraries/catalog/local'
import type { MirroredLibraryCatalog } from '@/app/libraries/catalog/mirrored'

/** Where one pinned or latest library revision stands while the engine resolves it. */
export type LibraryResolutionState = 'syncing' | 'failed'

/** The map key joining a library to one of its revisions. */
export function libraryResolutionKey(libraryId: string, revisionId: string): string {
  return `${libraryId}\0${revisionId}`
}

/** Resolution state per revision, keyed by `libraryResolutionKey`; a missing key means mirrored or never requested. */
export const librarySyncResolution = shallowRef<Map<string, LibraryResolutionState>>(
  new Map<string, LibraryResolutionState>()
)

/** Settles every `syncing` row as `failed`: nothing is going to deliver them. */
export function failSyncingResolutions(): void {
  const map = librarySyncResolution.value
  if (![...map.values()].includes('syncing')) return
  const next = new Map(map)
  for (const [key, state] of next) {
    if (state === 'syncing') next.set(key, 'failed')
  }
  librarySyncResolution.value = next
}

/** What `librarySyncRemote` publishes: the mirror the engine fills and the catalog that reads it. */
export interface LibrarySyncRemote {
  mirror: LocalLibraryCatalog
  catalog: MirroredLibraryCatalog
  /** The mirror database's name; changes whenever the remote identity does. */
  dbName: string
}

/** The remote identity the engine currently syncs, or none. */
export const librarySyncRemote = shallowRef<LibrarySyncRemote | null>(null)
