import type { DBSchema, IDBPDatabase } from 'idb'

import type {
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

import { APP_DATABASE_NAMES, defineAppDatabase, openAppDatabase } from '@/app/storage/idb'

const DATABASE_NAME = APP_DATABASE_NAMES.libraries

const libraryDatabase = defineAppDatabase<LocalLibraryDatabase>({
  name: APP_DATABASE_NAMES.libraries,
  version: 1,
  callbacks: {
    upgrade(database) {
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
  readonly #database: Promise<IDBPDatabase<LocalLibraryDatabase>>

  constructor(databaseName = DATABASE_NAME) {
    this.#database = openAppDatabase({ ...libraryDatabase, name: databaseName })
  }

  async listLibraries(): Promise<LibrarySummary[]> {
    return (await this.#database).getAll('latest')
  }

  async getRevision(libraryId: string, revisionId?: string): Promise<ComponentLibraryRevision> {
    const database = await this.#database
    const resolvedRevisionId =
      revisionId ?? (await database.get('latest', libraryId))?.latestRevisionId
    const stored = resolvedRevisionId
      ? await database.get('revisions', [libraryId, resolvedRevisionId])
      : undefined
    if (!stored)
      throw new Error(`Library revision not found: ${libraryId}/${revisionId ?? 'latest'}`)
    return deserializeLibraryRevision(stored.revision)
  }

  async cacheRevision(revision: ComponentLibraryRevision, updateLatest = true): Promise<void> {
    const database = await this.#database
    const transaction = database.transaction(['latest', 'revisions'], 'readwrite')
    const manifest = revision.manifest
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
    const database = await this.#database
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
}
