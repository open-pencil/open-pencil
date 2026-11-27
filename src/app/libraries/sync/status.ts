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

/**
 * Settles every `syncing` row as `failed`: nothing is going to deliver them. A caller finishing
 * work that started before a resume passes the epoch it captured — a resume voided every verdict
 * of that generation, so the rows it cleared must not be failed again.
 */
export function failSyncingResolutions(expectedEpoch?: number): void {
  if (expectedEpoch !== undefined && expectedEpoch !== currentResolutionsEpoch()) return
  const map = librarySyncResolution.value
  if (![...map.values()].includes('syncing')) return
  const next = new Map(map)
  for (const [key, state] of next) {
    if (state === 'syncing') next.set(key, 'failed')
  }
  librarySyncResolution.value = next
}

/**
 * How many resumes have voided the `failed` verdicts. A pull pass captures it when its
 * resolution snapshot is built and drops `failed` entries on publish once it moved, since
 * a resume judged every pre-resume failure void. `failSyncingResolutions` stays out of it:
 * a park verdict is not a resume.
 */
let resolutionsEpoch = 0

/** The resume generation a pass compares its captured epoch against. */
export function currentResolutionsEpoch(): number {
  return resolutionsEpoch
}

/**
 * A resume voids every `failed` verdict — the next pass re-derives those needs — and bumps
 * the epoch so a pass in flight does not republish the pre-resume failures its snapshot
 * still holds. `syncing` rows survive: they are work the pass is doing, not a verdict.
 */
export function clearFailedResolutions(): void {
  resolutionsEpoch += 1
  librarySyncResolution.value = new Map(
    [...librarySyncResolution.value].filter(([, state]) => state === 'syncing')
  )
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
