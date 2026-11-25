import type {
  ComponentLibraryManifest,
  ComponentLibraryRevision,
  LibraryCatalog,
  LibrarySummary,
  PublishLibraryInput
} from '@open-pencil/core/library'

import { LibraryContentSyncingError, LibraryRevisionMissingError } from '@/app/libraries/errors'

import { LocalLibraryCatalog, localLibraryCatalog } from './local'

export type LibraryCatalogSource = 'local' | 'storage'

/** Lazily resolves the storage catalog; `null` means no remote is configured. */
export type RemoteLibraryCatalogProvider = () => Promise<LibraryCatalog | null>

/**
 * Routes catalog traffic by source. Storage-source reads come from the local mirror and never
 * touch the network: a miss reports the content as still syncing. Publishing writes the remote
 * first, then mirrors the result; a failed mirror write only schedules a resync.
 */
export class MirroredLibraryCatalog implements LibraryCatalog {
  /** The catalog a service holds while the sync engine has no remote; its mirror stays empty. */
  static placeholder(): MirroredLibraryCatalog {
    return new MirroredLibraryCatalog(
      localLibraryCatalog,
      async () => null,
      new LocalLibraryCatalog('open-pencil-libraries-remote-none')
    )
  }

  readonly #local: LocalLibraryCatalog
  readonly #remote: RemoteLibraryCatalogProvider
  readonly #mirror: LocalLibraryCatalog
  readonly #onRemoteWrite: (() => void) | undefined
  #source: LibraryCatalogSource = 'local'

  constructor(
    local: LocalLibraryCatalog,
    remote: RemoteLibraryCatalogProvider,
    mirror: LocalLibraryCatalog,
    onRemoteWrite?: () => void
  ) {
    this.#local = local
    this.#remote = remote
    this.#mirror = mirror
    this.#onRemoteWrite = onRemoteWrite
  }

  get source(): LibraryCatalogSource {
    return this.#source
  }

  useLocal(): void {
    this.#source = 'local'
  }

  /** Switches reads and writes to storage; publishes resolve the remote through the provider. */
  useStorage(): void {
    this.#source = 'storage'
  }

  /** Where reads of the active source land. */
  #reads(): LocalLibraryCatalog {
    return this.#source === 'local' ? this.#local : this.#mirror
  }

  async listLibraries(): Promise<LibrarySummary[]> {
    return this.#reads().listLibraries()
  }

  async getRevision(libraryId: string, revisionId?: string): Promise<ComponentLibraryRevision> {
    try {
      return await this.#reads().getRevision(libraryId, revisionId)
    } catch (error) {
      if (this.#source === 'storage' && error instanceof LibraryRevisionMissingError) {
        throw new LibraryContentSyncingError(libraryId, revisionId)
      }
      throw error
    }
  }

  /** A revision's manifest (the latest's when omitted) without rebuilding its graph. */
  async getManifest(libraryId: string, revisionId?: string): Promise<ComponentLibraryManifest> {
    const manifest = await this.#reads().getManifest(libraryId, revisionId)
    if (!manifest && this.#source === 'storage') {
      throw new LibraryContentSyncingError(libraryId, revisionId)
    }
    if (!manifest) throw new LibraryRevisionMissingError(libraryId, revisionId)
    return manifest
  }

  async publishRevision(input: PublishLibraryInput): Promise<ComponentLibraryRevision> {
    if (this.#source === 'local') return this.#local.publishRevision(input)
    const remote = await this.#remote()
    if (!remote) throw new Error('Library catalog is not configured')
    const revision = await remote.publishRevision(input)
    try {
      await this.#mirror.cacheRevision(revision)
    } catch (error) {
      // The publish already landed remotely; the mirror catches up on the next sync pass.
      console.warn('[Libraries] Failed to mirror a published revision', error)
      this.#onRemoteWrite?.()
    }
    return revision
  }
}
