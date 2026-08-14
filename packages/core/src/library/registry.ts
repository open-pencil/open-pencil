import { createLibraryRevision } from './revision'
import { deserializeLibraryRevision, serializeLibraryRevision } from './serialization'
import type {
  ComponentLibraryRevision,
  LibraryCatalog,
  LibrarySummary,
  PublishLibraryInput
} from './types'

function revisionKey(libraryId: string, revisionId: string): string {
  return `${libraryId}\u0000${revisionId}`
}

export class MemoryLibraryCatalog implements LibraryCatalog {
  readonly #latest = new Map<string, string>()
  readonly #revisions = new Map<string, ComponentLibraryRevision>()

  async listLibraries(): Promise<LibrarySummary[]> {
    return [...this.#latest].flatMap(([libraryId, revisionId]) => {
      const revision = this.#revisions.get(revisionKey(libraryId, revisionId))
      return revision
        ? [
            {
              libraryId,
              name: revision.manifest.name,
              latestRevisionId: revisionId,
              publishedAt: revision.manifest.publishedAt,
              assetCount: revision.manifest.assets.length
            }
          ]
        : []
    })
  }

  async getRevision(libraryId: string, revisionId?: string): Promise<ComponentLibraryRevision> {
    const resolvedRevisionId = revisionId ?? this.#latest.get(libraryId)
    const revision = resolvedRevisionId
      ? this.#revisions.get(revisionKey(libraryId, resolvedRevisionId))
      : undefined
    if (!revision)
      throw new Error(`Library revision not found: ${libraryId}/${revisionId ?? 'latest'}`)
    return deserializeLibraryRevision(serializeLibraryRevision(revision))
  }

  async publishRevision(input: PublishLibraryInput): Promise<ComponentLibraryRevision> {
    const latestRevisionId = this.#latest.get(input.libraryId) ?? null
    if ((input.previousRevisionId ?? null) !== latestRevisionId) {
      throw new Error('Library revision conflict: latest revision has changed')
    }
    const revision = await createLibraryRevision(input)
    const currentLatestRevisionId = this.#latest.get(input.libraryId) ?? null
    if ((input.previousRevisionId ?? null) !== currentLatestRevisionId) {
      throw new Error('Library revision conflict: latest revision has changed')
    }
    const stored = deserializeLibraryRevision(serializeLibraryRevision(revision))
    this.#revisions.set(revisionKey(input.libraryId, revision.manifest.revisionId), stored)
    this.#latest.set(input.libraryId, revision.manifest.revisionId)
    return deserializeLibraryRevision(serializeLibraryRevision(stored))
  }
}
