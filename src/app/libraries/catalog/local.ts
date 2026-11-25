import type { DBSchema } from 'idb'

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
      await transaction.objectStore('latest').put(
        {
          libraryId: manifest.libraryId,
          name: manifest.name,
          latestRevisionId: manifest.revisionId,
          publishedAt: manifest.publishedAt,
          assetCount: manifest.assets.length
        },
        manifest.libraryId
      )
    }
    await transaction.done
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

  /** Writes `latest` rows without the revisions they point at; bodies follow the needs. */
  async cacheSummaries(summaries: readonly LibrarySummary[]): Promise<void> {
    if (summaries.length === 0) return
    const database = await this.#database.open()
    const transaction = database.transaction('latest', 'readwrite')
    for (const summary of summaries) {
      await transaction.store.put(summary, summary.libraryId)
    }
    await transaction.done
  }

  /** Close the underlying connection so the database can be deleted or replaced. */
  async close(): Promise<void> {
    this.#manifests.clear()
    await this.#database.close()
  }
}

/** The local-source catalog the app shares; the mirror never replaces it, so nothing closes it. */
export const localLibraryCatalog = new LocalLibraryCatalog()
