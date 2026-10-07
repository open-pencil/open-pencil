import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'

import * as v from 'valibot'

import type {
  ComponentLibraryRevision,
  LibraryCatalog,
  LibrarySummary,
  PublishLibraryInput,
  StoredLibraryLatestManifest
} from '@open-pencil/core/library'
import {
  createLibraryRevision,
  deserializeLibraryRevision,
  LibrarySummarySchema,
  MAX_LIBRARY_REVISION_BYTES,
  SerializedLibraryRevisionSchema,
  serializeLibraryRevision,
  StoredLibraryLatestManifestSchema,
  validateLibraryRevision
} from '@open-pencil/core/library'

const catalogPublicationQueues = new Map<string, Promise<void>>()

async function serializePublication<T>(root: string, operation: () => Promise<T>): Promise<T> {
  const previous = catalogPublicationQueues.get(root) ?? Promise.resolve()
  let release: (() => void) | undefined
  const current = new Promise<void>((resolveQueue) => {
    release = resolveQueue
  })
  const tail = previous.then(() => current)
  catalogPublicationQueues.set(root, tail)
  await previous
  try {
    return await operation()
  } finally {
    release?.()
    if (catalogPublicationQueues.get(root) === tail) catalogPublicationQueues.delete(root)
  }
}

export class FileSystemLibraryCatalog implements LibraryCatalog {
  readonly #root: string

  constructor(root: string) {
    this.#root = resolve(root)
  }

  async listLibraries(): Promise<LibrarySummary[]> {
    try {
      return await this.#readJSON('libraries.json', v.array(LibrarySummarySchema))
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []
      throw error
    }
  }

  async getRevision(libraryId: string, revisionId?: string): Promise<ComponentLibraryRevision> {
    const resolvedRevisionId =
      revisionId ??
      (await this.#readJSON(`${libraryId}/manifest.json`, StoredLibraryLatestManifestSchema))
        .summary.latestRevisionId
    const data = await this.#readJSON(
      `${libraryId}/revisions/${resolvedRevisionId}.json`,
      SerializedLibraryRevisionSchema,
      MAX_LIBRARY_REVISION_BYTES
    )
    const revision = deserializeLibraryRevision(data)
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
    return serializePublication(this.#root, async () => {
      const current = (await this.listLibraries()).find(
        (item) => item.libraryId === input.libraryId
      )
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
    })
  }

  #path(relative: string): string {
    if (relative.split(/[\\/]/).some((segment) => segment === '..'))
      throw new Error('Invalid catalog path')
    const path = resolve(this.#root, relative)
    if (path !== this.#root && !path.startsWith(`${this.#root}${sep}`))
      throw new Error('Invalid catalog path')
    return path
  }

  async #readJSON<TSchema extends v.GenericSchema>(
    relative: string,
    schema: TSchema,
    maxBytes = Number.POSITIVE_INFINITY
  ): Promise<v.InferOutput<TSchema>> {
    const bytes = await readFile(this.#path(relative))
    if (bytes.byteLength > maxBytes)
      throw new Error(`Library catalog file exceeds size limit: ${relative}`)
    const text = new TextDecoder().decode(bytes)
    const result = v.safeParse(v.pipe(v.string(), v.parseJson(), schema), text)
    if (!result.success)
      throw new Error(`Invalid library catalog file ${relative}: ${v.summarize(result.issues)}`)
    return result.output
  }

  async #writeJSON(relative: string, value: unknown): Promise<void> {
    const path = this.#path(relative)
    const temporaryPath = `${path}.${crypto.randomUUID()}.tmp`
    await mkdir(dirname(path), { recursive: true })
    await writeFile(temporaryPath, JSON.stringify(value, null, 2))
    await rename(temporaryPath, path)
  }
}
