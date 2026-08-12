import { markRaw, shallowRef } from 'vue'

import { materializeLibraryAsset } from '@open-pencil/core/library'
import type {
  ComponentLibraryRevision,
  LibraryAssetDescriptor,
  LibraryCatalog,
  LibrarySummary,
  PublishLibraryInput
} from '@open-pencil/core/library'

import type { EditorStore } from '@/app/editor/session'
import { LocalLibraryCatalog } from '@/app/libraries/catalog/local'

export interface EnabledLibraryAsset {
  libraryId: string
  libraryName: string
  revisionId: string
  asset: LibraryAssetDescriptor
}

export class LibraryService {
  readonly #catalog: LibraryCatalog
  readonly #summaries = shallowRef<LibrarySummary[]>([])
  readonly #enabledAssets = shallowRef<EnabledLibraryAsset[]>([])
  readonly #revisionCache = new Map<string, ComponentLibraryRevision>()

  constructor(catalog: LibraryCatalog = new LocalLibraryCatalog()) {
    this.#catalog = markRaw(catalog)
  }

  get summaries() {
    return this.#summaries
  }

  get enabledAssets() {
    return this.#enabledAssets
  }

  async refresh(editor: EditorStore): Promise<void> {
    this.#summaries.value = await this.#catalog.listLibraries()
    const assets: EnabledLibraryAsset[] = []
    for (const binding of editor.graph.enabledLibraries.values()) {
      if (!binding.enabled) continue
      const revision = await this.#getRevision(binding.libraryId, binding.revisionId)
      assets.push(
        ...revision.manifest.assets.map((asset) => ({
          libraryId: binding.libraryId,
          libraryName: revision.manifest.name,
          revisionId: binding.revisionId,
          asset
        }))
      )
    }
    this.#enabledAssets.value = assets
  }

  async publish(input: PublishLibraryInput): Promise<ComponentLibraryRevision> {
    const revision = await this.#catalog.publishRevision(input)
    this.#revisionCache.set(
      this.#revisionCacheKey(input.libraryId, revision.manifest.revisionId),
      revision
    )
    this.#summaries.value = await this.#catalog.listLibraries()
    return revision
  }

  async enable(editor: EditorStore, libraryId: string, revisionId?: string): Promise<void> {
    const revision = await this.#getRevision(libraryId, revisionId)
    editor.graph.enabledLibraries.set(libraryId, {
      libraryId,
      revisionId: revision.manifest.revisionId,
      enabled: true
    })
    await this.refresh(editor)
  }

  async disable(editor: EditorStore, libraryId: string): Promise<void> {
    const binding = editor.graph.enabledLibraries.get(libraryId)
    if (binding) editor.graph.enabledLibraries.set(libraryId, { ...binding, enabled: false })
    await this.refresh(editor)
  }

  async materialize(editor: EditorStore, libraryId: string, revisionId: string, assetKey: string) {
    const revision = await this.#getRevision(libraryId, revisionId)
    const result = materializeLibraryAsset(editor.graph, revision, assetKey)
    editor.requestRender()
    return result
  }

  #revisionCacheKey(libraryId: string, revisionId: string): string {
    return `${libraryId}\u0000${revisionId}`
  }

  async #getRevision(libraryId: string, revisionId?: string): Promise<ComponentLibraryRevision> {
    if (revisionId) {
      const cached = this.#revisionCache.get(this.#revisionCacheKey(libraryId, revisionId))
      if (cached) return cached
    }
    const revision = await this.#catalog.getRevision(libraryId, revisionId)
    this.#revisionCache.set(
      this.#revisionCacheKey(libraryId, revision.manifest.revisionId),
      revision
    )
    return revision
  }
}

let service: LibraryService | undefined

export function useLibraryService(): LibraryService {
  service ??= new LibraryService()
  return service
}
