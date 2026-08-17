import {
  isLibraryRevisionIntegrityError,
  type ComponentLibraryRevision,
  type LibraryCatalog,
  type LibrarySummary,
  type PublishLibraryInput
} from '@open-pencil/core/library'

import type { LocalLibraryCatalog } from './local'

export type LibraryCatalogSource = 'local' | 'storage'

export class RoutedLibraryCatalog implements LibraryCatalog {
  readonly #local: LocalLibraryCatalog
  #remote: LibraryCatalog | null = null
  #source: LibraryCatalogSource = 'local'

  constructor(local: LocalLibraryCatalog) {
    this.#local = local
  }

  get source(): LibraryCatalogSource {
    return this.#source
  }

  useLocal(): void {
    this.#source = 'local'
  }

  useStorage(remote: LibraryCatalog): void {
    this.#remote = remote
    this.#source = 'storage'
  }

  async listLibraries(): Promise<LibrarySummary[]> {
    if (this.#source === 'local' || !this.#remote) return this.#local.listLibraries()
    try {
      return await this.#remote.listLibraries()
    } catch (error) {
      console.warn('[Libraries] Remote catalog unavailable, using cached libraries', error)
      return this.#local.listLibraries()
    }
  }

  async getRevision(libraryId: string, revisionId?: string): Promise<ComponentLibraryRevision> {
    if (this.#source === 'local' || !this.#remote) {
      return this.#local.getRevision(libraryId, revisionId)
    }
    try {
      const revision = await this.#remote.getRevision(libraryId, revisionId)
      await this.#local.cacheRevision(revision, revisionId === undefined)
      return revision
    } catch (error) {
      if (isLibraryRevisionIntegrityError(error)) throw error
      console.warn('[Libraries] Remote revision unavailable, using cached revision', error)
      return this.#local.getRevision(libraryId, revisionId)
    }
  }

  async publishRevision(input: PublishLibraryInput): Promise<ComponentLibraryRevision> {
    if (this.#source === 'local' || !this.#remote) return this.#local.publishRevision(input)
    const revision = await this.#remote.publishRevision(input)
    await this.#local.cacheRevision(revision)
    return revision
  }
}
