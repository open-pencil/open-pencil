import { limitAsync } from 'es-toolkit'

import { isLibraryRevisionIntegrityError, type LibrarySummary } from '@open-pencil/core/library'
import { errorMessage } from '@open-pencil/std/errors'

import type { EditorStore } from '@/app/editor/session'
import type { LibraryObjectStore } from '@/app/integrations/storage'
import { LIBRARY_PREFIX, parseLibraryKey } from '@/app/integrations/storage/library-keys'
import type { LocalLibraryCatalog } from '@/app/libraries/catalog/local'
import type { MirroredLibraryCatalog } from '@/app/libraries/catalog/mirrored'
import { MANIFEST_FETCH_CONCURRENCY, StorageLibraryCatalog } from '@/app/libraries/catalog/storage'
import { LibraryContentInvalidError, LibraryRevisionMissingError } from '@/app/libraries/errors'
import { computeNeeds, type NeedsFlags, type RevisionNeed } from '@/app/libraries/sync/needs'
import {
  failSyncingResolutions,
  librarySyncResolution,
  type LibraryResolutionState,
  type LibrarySyncRemote
} from '@/app/libraries/sync/status'
import { isPermanentError } from '@/app/storage/sync/engine'

/** Revision bodies are bandwidth-bound, so fewer run at once than the small manifests. */
const REVISION_CONCURRENCY = 4

/** The first retryable and the first parked failure one pass met. */
export interface PassOutcome {
  transient?: unknown
  permanent?: unknown
}

export interface PassRequest extends NeedsFlags {
  /** List the remote and refresh the summaries of libraries whose keys changed. */
  probe: boolean
}

interface ListedLibrary {
  manifest: boolean
  revisions: Set<string>
}

/** Content a retry cannot repair: absent, unreadable, or failing its integrity checks. */
function isBrokenContent(error: unknown): boolean {
  return (
    error instanceof LibraryRevisionMissingError ||
    error instanceof LibraryContentInvalidError ||
    isLibraryRevisionIntegrityError(error)
  )
}

/**
 * One remote identity. `close()` aborts it, so a pass still running against a replaced remote
 * throws an abort error at its next checkpoint instead of writing into the new remote's state.
 */
export class LibrarySyncSession implements LibrarySyncRemote {
  readonly mirror: LocalLibraryCatalog
  readonly catalog: MirroredLibraryCatalog
  /** The mirror database's name; changes whenever the remote identity does. */
  readonly dbName: string
  readonly #openObjects: () => Promise<LibraryObjectStore | null>
  readonly #abort = new AbortController()
  /** Per library, the revision keys a manifest read accounted for: all known means no publish. */
  readonly #known = new Map<string, ReadonlySet<string>>()
  #failures: PassOutcome = {}

  constructor(
    mirror: LocalLibraryCatalog,
    catalog: MirroredLibraryCatalog,
    dbName: string,
    openObjects: () => Promise<LibraryObjectStore | null>
  ) {
    this.mirror = mirror
    this.catalog = catalog
    this.dbName = dbName
    this.#openObjects = openObjects
  }

  async close(): Promise<void> {
    this.#abort.abort()
    await this.mirror.close().catch((error: unknown) => {
      console.warn('[Library sync] mirror failed to close:', errorMessage(error))
    })
  }

  /** One pass: probe when asked, then pull what open documents need. */
  async pass(request: PassRequest, stores: readonly EditorStore[]): Promise<PassOutcome> {
    this.#failures = {}
    const objects = await this.#openObjects().catch((error: unknown) => {
      this.#record(error)
      return null
    })
    this.#assertOpen()
    if (!objects) {
      // Nothing will arrive on its own: waiting rows settle as failed rather than hang.
      failSyncingResolutions()
      return this.#failures
    }
    const remote = new StorageLibraryCatalog(objects)
    if (request.probe) {
      await this.#probe(objects, remote).catch((error: unknown) => this.#record(error))
    }
    await this.#pull(remote, request, stores).catch((error: unknown) => this.#record(error))
    return this.#failures
  }

  #assertOpen(): void {
    this.#abort.signal.throwIfAborted()
  }

  /** Files a failure under the pass; one met after `close()` belongs to a dead remote and aborts. */
  #record(error: unknown): void {
    this.#assertOpen()
    this.#failures[isPermanentError(error) ? 'permanent' : 'transient'] ??= error
  }

  /** One listing, then a manifest read per library whose keys changed; vanished libraries are dropped. */
  async #probe(objects: LibraryObjectStore, remote: StorageLibraryCatalog): Promise<void> {
    const listed = await objects.listObjects(`${LIBRARY_PREFIX}/`)
    this.#assertOpen()
    const listing = new Map<string, ListedLibrary>()
    for (const { key } of listed) {
      const parsed = parseLibraryKey(key)
      if (!parsed) continue
      const entry = listing.get(parsed.libraryId) ?? { manifest: false, revisions: new Set() }
      if (parsed.kind === 'latest') entry.manifest = true
      else entry.revisions.add(parsed.revisionId)
      listing.set(parsed.libraryId, entry)
    }
    const rows = await this.mirror.listLibraries()
    this.#assertOpen()
    for (const { libraryId } of rows) {
      // Revision keys without a manifest are debris, not a library.
      if (listing.get(libraryId)?.manifest) continue
      this.#known.delete(libraryId)
      await this.mirror.deleteLibrary(libraryId).catch((error: unknown) => this.#record(error))
    }
    const changed = [...listing].filter(([libraryId, entry]) => {
      const known = this.#known.get(libraryId)
      return entry.manifest && (!known || [...entry.revisions].some((id) => !known.has(id)))
    })
    const syncLibrary = limitAsync(async ([libraryId, { revisions }]: [string, ListedLibrary]) => {
      try {
        const summary = await remote.getSummary(libraryId)
        this.#assertOpen()
        // A manifest this version cannot read is left out; it is read again once its keys change.
        if (!summary) return
        await this.mirror.cacheSummaries([summary])
        const known = this.#known.get(libraryId)
        // A publish writes its revision before its manifest, so the listing counts only when
        // the manifest names a revision the listing showed (a new one, once seen before).
        const accountedFor =
          revisions.has(summary.latestRevisionId) &&
          (!known || !known.has(summary.latestRevisionId))
        if (accountedFor) this.#known.set(libraryId, revisions)
      } catch (error) {
        this.#record(error)
      }
    }, MANIFEST_FETCH_CONCURRENCY)
    await Promise.all(changed.map((entry) => syncLibrary(entry)))
  }

  /**
   * Pull the needed revisions the mirror lacks. Each lands in `librarySyncResolution` as
   * `syncing`; unrepairable content settles as `failed`, transient errors stay `syncing`.
   */
  async #pull(
    remote: StorageLibraryCatalog,
    request: PassRequest,
    stores: readonly EditorStore[]
  ): Promise<void> {
    const rows = await this.mirror.listLibraries().catch((error: unknown) => {
      this.#record(error)
      return [] as LibrarySummary[]
    })
    this.#assertOpen()
    const latestByLibrary = new Map(rows.map((row) => [row.libraryId, row.latestRevisionId]))
    const resolution = new Map<string, LibraryResolutionState>()
    const toPull: RevisionNeed[] = []
    for (const [key, need] of computeNeeds(stores, latestByLibrary, request)) {
      const mirrored = await this.mirror
        .hasRevision(need.libraryId, need.revisionId)
        .catch((error: unknown) => {
          this.#record(error)
          return false
        })
      this.#assertOpen()
      if (mirrored) continue
      // Read the live map per key: a concurrent pass may already have failed this one.
      if (librarySyncResolution.value.get(key) === 'failed') {
        resolution.set(key, 'failed')
        continue
      }
      resolution.set(key, 'syncing')
      toPull.push(need)
    }
    librarySyncResolution.value = resolution

    const publish = () => {
      if (!this.#abort.signal.aborted) librarySyncResolution.value = new Map(resolution)
    }
    const markFailed = (key: string) => {
      resolution.set(key, 'failed')
      publish()
    }
    const fetchRevision = limitAsync(async (need: RevisionNeed) => {
      try {
        const revision = await remote.getRevision(need.libraryId, need.revisionId)
        this.#assertOpen()
        // Keep the `latest` row: bumping it here could roll back a publish that landed since.
        await this.mirror.cacheRevision(revision, false)
        resolution.delete(need.key)
        publish()
      } catch (error) {
        if (isBrokenContent(error)) return markFailed(need.key)
        this.#record(error)
        if (isPermanentError(error)) markFailed(need.key)
      }
    }, REVISION_CONCURRENCY)
    await Promise.all(toPull.map((need) => fetchRevision(need)))
  }
}
