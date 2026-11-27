import type { DBSchema, IDBPTransaction } from 'idb'

import type {
  ComponentLibraryManifest,
  ComponentLibraryRevision,
  LibraryCatalog,
  LibrarySummary,
  PublishLibraryInput,
  SerializedComponentLibraryRevision
} from '@open-pencil/core/library'
import {
  createLibraryRevision,
  deserializeLibraryRevision,
  serializeLibraryRevision
} from '@open-pencil/core/library'

import { LibraryRevisionMissingError } from '@/app/libraries/errors'
import { libraryResolutionKey } from '@/app/libraries/sync/status'
import {
  APP_DATABASE_NAMES,
  connectAppDatabase,
  defineAppDatabase,
  type AppDatabase
} from '@/app/storage/idb'

const DATABASE_NAME = APP_DATABASE_NAMES.libraries

/** Most recent manifests `getManifest` hands out without rebuilding revision graphs. */
const MANIFEST_CACHE_LIMIT = 200

/** Ancestry deeper than this proves nothing either way; the write is accepted on doubt. */
const ANCESTRY_SCAN_LIMIT = 100

const libraryDatabase = defineAppDatabase<LocalLibraryDatabase>({
  name: APP_DATABASE_NAMES.libraries,
  version: 2,
  callbacks: {
    upgrade(database, oldVersion, _newVersion, transaction) {
      // Version 1 held libraries of the first library schema, which this one cannot read; they
      // are published again.
      if (oldVersion === 1) {
        void transaction.objectStore('revisions').clear()
        void transaction.objectStore('latest').clear()
      }
      if (!database.objectStoreNames.contains('revisions')) {
        const revisions = database.createObjectStore('revisions', {
          keyPath: ['libraryId', 'revisionId']
        })
        revisions.createIndex('by-library', 'libraryId')
      }
      if (!database.objectStoreNames.contains('latest')) {
        database.createObjectStore('latest')
      }
    }
  }
})

interface StoredLibraryRevision {
  libraryId: string
  revisionId: string
  revision: SerializedComponentLibraryRevision
}

interface LocalLibraryDatabase extends DBSchema {
  revisions: {
    key: [string, string]
    value: StoredLibraryRevision
    indexes: { 'by-library': string }
  }
  latest: {
    key: string
    value: LibrarySummary
  }
}

export class LocalLibraryCatalog implements LibraryCatalog {
  readonly #database: AppDatabase<LocalLibraryDatabase>
  readonly #manifests = new Map<string, ComponentLibraryManifest>()

  constructor(databaseName: string = DATABASE_NAME) {
    this.#database = connectAppDatabase({ ...libraryDatabase, name: databaseName })
  }

  async listLibraries(): Promise<LibrarySummary[]> {
    return (await this.#database.open()).getAll('latest')
  }

  async getRevision(libraryId: string, revisionId?: string): Promise<ComponentLibraryRevision> {
    const database = await this.#database.open()
    const resolvedRevisionId =
      revisionId ?? (await database.get('latest', libraryId))?.latestRevisionId
    const stored = resolvedRevisionId
      ? await database.get('revisions', [libraryId, resolvedRevisionId])
      : undefined
    if (!stored) {
      throw new LibraryRevisionMissingError(libraryId, resolvedRevisionId)
    }
    return deserializeLibraryRevision(stored.revision)
  }

  /** Reads a manifest without rebuilding the graph, through a small insertion-ordered cache. */
  async getManifest(
    libraryId: string,
    revisionId?: string
  ): Promise<ComponentLibraryManifest | null> {
    const database = await this.#database.open()
    const resolvedRevisionId =
      revisionId ?? (await database.get('latest', libraryId))?.latestRevisionId
    if (!resolvedRevisionId) return null
    const key = libraryResolutionKey(libraryId, resolvedRevisionId)
    const cached = this.#manifests.get(key)
    if (cached) return cached
    const stored = await database.get('revisions', [libraryId, resolvedRevisionId])
    if (!stored) return null
    this.#manifests.set(key, stored.revision.manifest)
    if (this.#manifests.size > MANIFEST_CACHE_LIMIT) {
      const oldest = this.#manifests.keys().next().value
      if (oldest !== undefined) this.#manifests.delete(oldest)
    }
    return stored.revision.manifest
  }

  async cacheRevision(revision: ComponentLibraryRevision, updateLatest = true): Promise<void> {
    const database = await this.#database.open()
    const transaction = database.transaction(['latest', 'revisions'], 'readwrite')
    const manifest = revision.manifest
    this.#manifests.delete(libraryResolutionKey(manifest.libraryId, manifest.revisionId))
    await transaction.objectStore('revisions').put({
      libraryId: manifest.libraryId,
      revisionId: manifest.revisionId,
      revision: serializeLibraryRevision(revision)
    })
    if (updateLatest) {
      await this.#putSummaryUnlessAncestor(transaction, {
        libraryId: manifest.libraryId,
        name: manifest.name,
        latestRevisionId: manifest.revisionId,
        previousRevisionId: manifest.previousRevisionId,
        publishedAt: manifest.publishedAt,
        assetCount: manifest.assets.length
      })
    }
    await transaction.done
  }

  /**
   * Writes a `latest` row unless its revision is the stored head or a proven ancestor of it,
   * inside the transaction the write belongs to. The chain — not `publishedAt`, a publisher
   * clock that skews — is what orders revisions: a head is never its own ancestor, so a
   * legitimate remote head is accepted whatever clock stamped it, while a stale observation
   * racing a publish's mirror write is proven stale by the chain and rejected. Ancestry that
   * cannot be proven (a revision body still syncing, or a chain longer than the scan limit)
   * accepts the write on doubt: the probe's etag bookkeeping heals a wrongly accepted row,
   * while a wrongly rejected remote head had no way back. Returns whether the stored row
   * names the incoming revision — write applied, or already stored.
   */
  async #putSummaryUnlessAncestor<Stores extends ('latest' | 'revisions')[]>(
    transaction: IDBPTransaction<LocalLibraryDatabase, Stores, 'readwrite'>,
    summary: LibrarySummary
  ): Promise<boolean> {
    const stored = await transaction.objectStore('latest').get(summary.libraryId)
    if (!stored) {
      await transaction.objectStore('latest').put(summary, summary.libraryId)
      return true
    }
    if (stored.latestRevisionId === summary.latestRevisionId) return true
    if (await this.#isAncestor(transaction, stored, summary.latestRevisionId)) return false
    await transaction.objectStore('latest').put(summary, summary.libraryId)
    return true
  }

  /**
   * Whether `candidateId` is a proven ancestor of the head the stored summary names. The
   * first step can come from the stored summary's own `previousRevisionId`, which covers a
   * head whose revision body is still syncing; deeper steps walk the bodies the mirror
   * holds. Any missing body ends the proof — accept-on-doubt, never reject on absence.
   */
  async #isAncestor<Stores extends ('latest' | 'revisions')[]>(
    transaction: IDBPTransaction<LocalLibraryDatabase, Stores, 'readwrite'>,
    stored: LibrarySummary,
    candidateId: string
  ): Promise<boolean> {
    if (stored.previousRevisionId === candidateId) return true
    let currentId: string | null = stored.latestRevisionId
    for (let depth = 0; depth < ANCESTRY_SCAN_LIMIT; depth++) {
      const storedRevision = await transaction
        .objectStore('revisions')
        .get([stored.libraryId, currentId])
      if (!storedRevision) return false
      const parent: string | null = storedRevision.revision.manifest.previousRevisionId
      if (parent === candidateId) return true
      if (!parent) return false
      currentId = parent
    }
    // A chain past the scan limit proves nothing either way.
    return false
  }

  async publishRevision(input: PublishLibraryInput): Promise<ComponentLibraryRevision> {
    const revision = await createLibraryRevision(input)
    const serializedRevision = serializeLibraryRevision(revision)
    const database = await this.#database.open()
    const transaction = database.transaction(['latest', 'revisions'], 'readwrite')
    const latest = await transaction.objectStore('latest').get(input.libraryId)
    if ((input.previousRevisionId ?? null) !== (latest?.latestRevisionId ?? null)) {
      transaction.abort()
      throw new Error('Library revision conflict: latest revision has changed')
    }
    const manifest = revision.manifest
    await transaction.objectStore('revisions').put({
      libraryId: manifest.libraryId,
      revisionId: manifest.revisionId,
      revision: serializedRevision
    })
    await transaction.objectStore('latest').put(
      {
        libraryId: manifest.libraryId,
        name: manifest.name,
        latestRevisionId: manifest.revisionId,
        previousRevisionId: manifest.previousRevisionId,
        publishedAt: manifest.publishedAt,
        assetCount: manifest.assets.length
      },
      manifest.libraryId
    )
    await transaction.done
    return revision
  }

  /** Removes a library's `latest` row and every stored revision, for a library gone upstream. */
  async deleteLibrary(libraryId: string): Promise<void> {
    const database = await this.#database.open()
    const transaction = database.transaction(['latest', 'revisions'], 'readwrite')
    await transaction.objectStore('latest').delete(libraryId)
    this.#manifests.clear()
    const revisionKeys = await transaction
      .objectStore('revisions')
      .index('by-library')
      .getAllKeys(libraryId)
    for (const key of revisionKeys) {
      await transaction.objectStore('revisions').delete(key)
    }
    await transaction.done
  }

  /** Whether a revision body is stored without deserializing it. */
  async hasRevision(libraryId: string, revisionId: string): Promise<boolean> {
    const database = await this.#database.open()
    return (await database.getKey('revisions', [libraryId, revisionId])) != null
  }

  /**
   * Writes a `latest` row without the revision it points at; the body follows the needs.
   * Resolves whether the stored row names the incoming revision — write applied or already
   * stored — so the probe records its manifest etag only for a row projecting the manifest
   * it actually read.
   */
  async cacheSummary(summary: LibrarySummary): Promise<boolean> {
    const database = await this.#database.open()
    const transaction = database.transaction(['latest', 'revisions'], 'readwrite')
    const named = await this.#putSummaryUnlessAncestor(transaction, summary)
    await transaction.done
    return named
  }

  /**
   * Retire the catalog: the connection closes so the database can be deleted or replaced, and
   * every later read rejects rather than connecting again — a replacement catalog is a new
   * instance, since a connection leaking past a delete blocks it for good.
   */
  async close(): Promise<void> {
    this.#manifests.clear()
    await this.#database.close()
  }
}

/** The local-source catalog the app shares; the mirror never replaces it, so nothing closes it. */
export const localLibraryCatalog = new LocalLibraryCatalog()
