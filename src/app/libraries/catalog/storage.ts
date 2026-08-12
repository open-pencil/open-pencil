import { decodeBase64, encodeBase64 } from '@open-pencil/core/bytes'
import {
  createLibraryRevision,
  deserializeLibraryRevision,
  MAX_LIBRARY_REVISION_BYTES,
  serializeLibraryRevision,
  validateLibraryRevision
} from '@open-pencil/core/library'
import type {
  ComponentLibraryRevision,
  LibraryCatalog,
  LibrarySummary,
  PublishLibraryInput,
  SerializedComponentLibraryRevision,
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

function encodeValue(value: unknown): unknown {
  if (value instanceof Uint8Array) return { $bytes: encodeBase64(value) }
  if (Array.isArray(value)) return value.map(encodeValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, encodeValue(entry)])
    )
  }
  return value
}

function decodeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeValue)
  if (value && typeof value === 'object') {
    if ('$bytes' in value && typeof (value as { $bytes?: unknown }).$bytes === 'string') {
      return decodeBase64((value as { $bytes: string }).$bytes)
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, decodeValue(entry)])
    )
  }
  return value
}

function encodeRevision(revision: ComponentLibraryRevision): Uint8Array {
  return textEncoder.encode(JSON.stringify(encodeValue(serializeLibraryRevision(revision))))
}

function decodeRevision(bytes: Uint8Array): ComponentLibraryRevision {
  const parsed = decodeValue(
    JSON.parse(textDecoder.decode(bytes))
  ) as SerializedComponentLibraryRevision
  return deserializeLibraryRevision(parsed)
}

function decodeLatest(bytes: Uint8Array): StoredLibraryLatestManifest {
  const parsed = JSON.parse(textDecoder.decode(bytes)) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid component library manifest')
  }
  const candidate = parsed as { schemaVersion?: unknown; summary?: unknown }
  if (
    candidate.schemaVersion !== 1 ||
    !candidate.summary ||
    typeof candidate.summary !== 'object' ||
    Array.isArray(candidate.summary) ||
    typeof (candidate.summary as { libraryId?: unknown }).libraryId !== 'string'
  ) {
    throw new Error('Invalid component library manifest')
  }
  return candidate as StoredLibraryLatestManifest
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
      if (bytes) summaries.push(decodeLatest(bytes).summary)
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
    const latest = await this.#latest(input.libraryId)
    if ((input.previousRevisionId ?? null) !== (latest?.latestRevisionId ?? null)) {
      throw new Error('Library revision conflict: latest revision has changed')
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
      latestKey(manifest.libraryId),
      textEncoder.encode(
        JSON.stringify({ schemaVersion: 1, summary } satisfies StoredLibraryLatestManifest)
      ),
      'application/json'
    )
    return revision
  }

  async #latest(libraryId: string): Promise<LibrarySummary | null> {
    const bytes = await this.#objects.getObject(latestKey(libraryId))
    return bytes ? decodeLatest(bytes).summary : null
  }
}
