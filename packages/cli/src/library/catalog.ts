import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'

import type {
  ComponentLibraryRevision,
  LibraryCatalog,
  LibrarySummary,
  PublishLibraryInput,
  SerializedComponentLibraryRevision,
  StoredLibraryLatestManifest
} from '@open-pencil/core/library'
import {
  createLibraryRevision,
  deserializeLibraryRevision,
  serializeLibraryRevision
} from '@open-pencil/core/library'

export class FileSystemLibraryCatalog implements LibraryCatalog {
  readonly #root: string

  constructor(root: string) {
    this.#root = resolve(root)
  }

  async listLibraries(): Promise<LibrarySummary[]> {
    const index = await this.#readJSON<LibrarySummary[]>('libraries.json').catch(() => [])
    return index
  }

  async getRevision(libraryId: string, revisionId?: string): Promise<ComponentLibraryRevision> {
    const resolvedRevisionId =
      revisionId ??
      (await this.#readJSON<StoredLibraryLatestManifest>(`${libraryId}/manifest.json`)).summary
        .latestRevisionId
    const data = await this.#readJSON<SerializedComponentLibraryRevision>(
      `${libraryId}/revisions/${resolvedRevisionId}.json`
    )
    return deserializeLibraryRevision(data)
  }

  async publishRevision(input: PublishLibraryInput): Promise<ComponentLibraryRevision> {
    const current = (await this.listLibraries()).find((item) => item.libraryId === input.libraryId)
    if ((input.previousRevisionId ?? null) !== (current?.latestRevisionId ?? null)) {
      throw new Error('Library revision conflict: latest revision has changed')
    }
    const revision = await createLibraryRevision(input)
    const manifest = revision.manifest
    await this.#writeJSON(
      `${manifest.libraryId}/revisions/${manifest.revisionId}.json`,
      serializeLibraryRevision(revision)
    )
    const summary: LibrarySummary = {
      libraryId: manifest.libraryId,
      name: manifest.name,
      latestRevisionId: manifest.revisionId,
      publishedAt: manifest.publishedAt,
      assetCount: manifest.assets.length
    }
    await this.#writeJSON(`${manifest.libraryId}/manifest.json`, {
      schemaVersion: 1,
      summary
    } satisfies StoredLibraryLatestManifest)
    const summaries = (await this.listLibraries()).filter(
      (item) => item.libraryId !== input.libraryId
    )
    summaries.push(summary)
    await this.#writeJSON(
      'libraries.json',
      summaries.sort((left, right) => left.name.localeCompare(right.name))
    )
    return revision
  }

  #path(relative: string): string {
    const path = resolve(this.#root, relative)
    if (path !== this.#root && !path.startsWith(`${this.#root}${sep}`))
      throw new Error('Invalid catalog path')
    return path
  }

  async #readJSON<T>(relative: string): Promise<T> {
    return JSON.parse(await readFile(this.#path(relative), 'utf8')) as T
  }

  async #writeJSON(relative: string, value: unknown): Promise<void> {
    const path = this.#path(relative)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(value, null, 2))
  }
}
