import { limitAsync } from 'es-toolkit'

import {
  COMPONENT_LIBRARY_SCHEMA_VERSION,
  createLibraryRevision,
  encodeStoredLibraryRevision,
  MAX_LIBRARY_REVISION_BYTES,
  validateLibraryRevision
} from '@open-pencil/core/library'
import type {
  ComponentLibraryRevision,
  LibraryCatalog,
  LibrarySummary,
  PublishLibraryInput,
  StoredLibraryLatestManifest
} from '@open-pencil/core/library'

import type { LibraryObjectStore } from '@/app/integrations/storage'
import {
  latestKey,
  LIBRARY_PREFIX,
  parseLibraryKey,
  revisionKey
} from '@/app/integrations/storage/library-keys'
import { LibraryContentInvalidError, LibraryRevisionMissingError } from '@/app/libraries/errors'

import { decodeLatestManifest, decodeStoredRevision } from './decode'

/** Manifests are small objects, so their reads are latency-bound and run wide. */
export const MANIFEST_FETCH_CONCURRENCY = 16

const textEncoder = new TextEncoder()

/** A summary read and the etag of the manifest object it came from. */
export interface LibrarySummaryValue {
  summary: LibrarySummary | null
  etag: string | null
}

function encodeRevision(revision: ComponentLibraryRevision): Uint8Array {
  return textEncoder.encode(JSON.stringify(encodeStoredLibraryRevision(revision)))
}

export class StorageLibraryCatalog implements LibraryCatalog {
  readonly #objects: LibraryObjectStore

  constructor(objects: LibraryObjectStore) {
    this.#objects = objects
  }

  async listLibraries(): Promise<LibrarySummary[]> {
    const listed = await this.#objects.listObjects(`${LIBRARY_PREFIX}/`)
    const libraryIds = listed.flatMap(({ key }) => {
      const parsed = parseLibraryKey(key)
      return parsed?.kind === 'latest' ? [parsed.libraryId] : []
    })
    const read = limitAsync(
      (libraryId: string) => this.getSummary(libraryId),
      MANIFEST_FETCH_CONCURRENCY
    )
    const summaries = (await Promise.all(libraryIds.map((libraryId) => read(libraryId)))).filter(
      (summary): summary is LibrarySummary => summary !== null
    )
    return summaries.sort((left, right) => left.name.localeCompare(right.name))
  }

  /**
   * The library's summary from its manifest, or `null` when there is none this version can
   * use: no manifest, one an earlier schema wrote, an unreadable one, or one naming another
   * library than the key it sits under. Such a library is left out until it is published
   * again, which replaces it.
   */
  async getSummary(libraryId: string): Promise<LibrarySummary | null> {
    return (await this.getSummaryValue(libraryId)).summary
  }

  /**
   * `getSummary` together with the etag of the manifest object it was read from, so a
   * caller mirroring the manifest can record the version of the content it actually
   * cached — a listing fetched moments earlier may name an older etag. The etag is `null`
   * when the store surfaces none.
   */
  async getSummaryValue(libraryId: string): Promise<LibrarySummaryValue> {
    try {
      const { summary, etag } = await this.#latestValue(libraryId)
      return { summary: summary?.libraryId === libraryId ? summary : null, etag }
    } catch (error) {
      if (error instanceof LibraryContentInvalidError) return { summary: null, etag: null }
      throw error
    }
  }

  async getRevision(libraryId: string, revisionId?: string): Promise<ComponentLibraryRevision> {
    const resolvedRevisionId = revisionId ?? (await this.#latest(libraryId))?.latestRevisionId
    if (!resolvedRevisionId) throw new LibraryRevisionMissingError(libraryId)
    const bytes = await this.#objects.getObject(revisionKey(libraryId, resolvedRevisionId))
    if (!bytes) throw new LibraryRevisionMissingError(libraryId, resolvedRevisionId)
    if (bytes.byteLength > MAX_LIBRARY_REVISION_BYTES) {
      throw new LibraryContentInvalidError('Component library revision exceeds size limit')
    }
    const revision = decodeStoredRevision(bytes)
    if (
      revision.manifest.libraryId !== libraryId ||
      revision.manifest.revisionId !== resolvedRevisionId
    ) {
      throw new LibraryContentInvalidError('Library revision identity mismatch')
    }
    await validateLibraryRevision(revision)
    return revision
  }

  async publishRevision(input: PublishLibraryInput): Promise<ComponentLibraryRevision> {
    const manifestKey = latestKey(input.libraryId)
    const latestValue = this.#objects.getObjectValue
      ? await this.#objects.getObjectValue(manifestKey)
      : { bytes: await this.#objects.getObject(manifestKey), etag: null }
    // Only a manifest that decodes and names this library is a usable baseline: an unreadable
    // or foreign one leaves the library republishable, which replaces it. The etag conditional
    // write below stays the real optimistic lock either way.
    let latest: LibrarySummary | null = null
    if (latestValue.bytes) {
      try {
        const decoded = decodeLatestManifest(latestValue.bytes)
        if (decoded && decoded.summary.libraryId === input.libraryId) {
          latest = decoded.summary
        }
      } catch (error) {
        if (!(error instanceof LibraryContentInvalidError)) throw error
      }
    }
    if ((input.previousRevisionId ?? null) !== (latest?.latestRevisionId ?? null)) {
      throw new Error('Library revision conflict: latest revision has changed')
    }
    // A manifest an earlier version wrote is replaced as a current one would be.
    const existing = latestValue.bytes !== null
    if (existing && !latestValue.etag) {
      throw new Error('Storage provider does not support conditional library publication')
    }
    const revision = await createLibraryRevision(input)
    const manifest = revision.manifest
    await this.#objects.putObject(
      revisionKey(manifest.libraryId, manifest.revisionId),
      encodeRevision(revision),
      'application/json'
    )
    const summary: LibrarySummary = {
      libraryId: manifest.libraryId,
      name: manifest.name,
      latestRevisionId: manifest.revisionId,
      previousRevisionId: manifest.previousRevisionId,
      publishedAt: manifest.publishedAt,
      assetCount: manifest.assets.length
    }
    await this.#objects.putObject(
      manifestKey,
      textEncoder.encode(
        JSON.stringify({
          schemaVersion: COMPONENT_LIBRARY_SCHEMA_VERSION,
          summary
        } satisfies StoredLibraryLatestManifest)
      ),
      'application/json',
      existing && latestValue.etag ? { ifMatch: latestValue.etag } : { ifNoneMatch: '*' }
    )
    return revision
  }

  async #latest(libraryId: string): Promise<LibrarySummary | null> {
    return (await this.#latestValue(libraryId)).summary
  }

  async #latestValue(libraryId: string): Promise<LibrarySummaryValue> {
    const value = this.#objects.getObjectValue
      ? await this.#objects.getObjectValue(latestKey(libraryId))
      : { bytes: await this.#objects.getObject(latestKey(libraryId)), etag: null }
    return {
      summary: value.bytes ? (decodeLatestManifest(value.bytes)?.summary ?? null) : null,
      etag: value.bytes ? value.etag : null
    }
  }
}
