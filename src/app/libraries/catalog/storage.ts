import * as v from 'valibot'

import {
  COMPONENT_LIBRARY_SCHEMA_VERSION,
  createLibraryRevision,
  deserializeLibraryRevision,
  encodeStoredLibraryRevision,
  MAX_LIBRARY_REVISION_BYTES,
  storedLibraryLatestManifestSchema,
  storedLibraryRevisionSchema,
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

const PREFIX = 'open-pencil/libraries'
const textDecoder = new TextDecoder()
const textEncoder = new TextEncoder()

function latestKey(libraryId: string): string {
  return `${PREFIX}/${libraryId}/manifest.json`
}

function revisionKey(libraryId: string, revisionId: string): string {
  return `${PREFIX}/${libraryId}/revisions/${revisionId}.json`
}

function encodeRevision(revision: ComponentLibraryRevision): Uint8Array {
  return textEncoder.encode(JSON.stringify(encodeStoredLibraryRevision(revision)))
}

const revisionSchema = v.pipe(v.string(), v.parseJson(), storedLibraryRevisionSchema)

const latestManifestSchema = v.pipe(v.string(), v.parseJson(), storedLibraryLatestManifestSchema)

function decodeRevision(bytes: Uint8Array): ComponentLibraryRevision {
  const parsed = v.safeParse(revisionSchema, textDecoder.decode(bytes))
  if (!parsed.success)
    throw new Error(`Invalid component library revision: ${v.summarize(parsed.issues)}`)
  return deserializeLibraryRevision(parsed.output)
}

/** A manifest an earlier version wrote, whose revisions this one cannot read. */
const earlierManifestSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({ schemaVersion: v.pipe(v.number(), v.maxValue(COMPONENT_LIBRARY_SCHEMA_VERSION - 1)) })
)

/** The library a manifest points at, or `null` for one an earlier version published. */
function decodeLatest(bytes: Uint8Array): StoredLibraryLatestManifest | null {
  const text = textDecoder.decode(bytes)
  const parsed = v.safeParse(latestManifestSchema, text)
  if (parsed.success) return parsed.output
  // Such a library is left out until it is published again, which replaces it.
  if (v.safeParse(earlierManifestSchema, text).success) return null
  throw new Error('Invalid component library manifest')
}

export class StorageLibraryCatalog implements LibraryCatalog {
  readonly #objects: LibraryObjectStore

  constructor(objects: LibraryObjectStore) {
    this.#objects = objects
  }

  async listLibraries(): Promise<LibrarySummary[]> {
    const objects = await this.#objects.listObjects(`${PREFIX}/`)
    const keys = objects.map((object) => object.key).filter((key) => key.endsWith('/manifest.json'))
    const summaries: LibrarySummary[] = []
    for (const key of keys) {
      const bytes = await this.#objects.getObject(key)
      const latest = bytes ? decodeLatest(bytes) : null
      if (latest) summaries.push(latest.summary)
    }
    return summaries.sort((left, right) => left.name.localeCompare(right.name))
  }

  async getRevision(libraryId: string, revisionId?: string): Promise<ComponentLibraryRevision> {
    const resolvedRevisionId = revisionId ?? (await this.#latest(libraryId))?.latestRevisionId
    if (!resolvedRevisionId) throw new Error(`Library not found: ${libraryId}`)
    const bytes = await this.#objects.getObject(revisionKey(libraryId, resolvedRevisionId))
    if (!bytes) throw new Error(`Library revision not found: ${libraryId}/${resolvedRevisionId}`)
    if (bytes.byteLength > MAX_LIBRARY_REVISION_BYTES)
      throw new Error('Component library revision exceeds size limit')
    const revision = decodeRevision(bytes)
    if (
      revision.manifest.libraryId !== libraryId ||
      revision.manifest.revisionId !== resolvedRevisionId
    ) {
      throw new Error('Library revision identity mismatch')
    }
    await validateLibraryRevision(revision)
    return revision
  }

  async publishRevision(input: PublishLibraryInput): Promise<ComponentLibraryRevision> {
    const manifestKey = latestKey(input.libraryId)
    const latestValue = this.#objects.getObjectValue
      ? await this.#objects.getObjectValue(manifestKey)
      : { bytes: await this.#objects.getObject(manifestKey), etag: null }
    const latest = latestValue.bytes ? (decodeLatest(latestValue.bytes)?.summary ?? null) : null
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
    const bytes = await this.#objects.getObject(latestKey(libraryId))
    return bytes ? (decodeLatest(bytes)?.summary ?? null) : null
  }
}
