import { markRaw, shallowRef } from 'vue'

import { reapplyInstanceComponentProperties } from '@open-pencil/core/editor'
import {
  materializeLibraryAsset,
  planLibraryInstanceUpdates,
  summarizeLibraryUpdate
} from '@open-pencil/core/library'
import type {
  ComponentLibraryRevision,
  LibraryAssetDescriptor,
  LibraryCatalog,
  LibrarySummary,
  LibraryUpdateSummary,
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
  readonly #updates = shallowRef<LibraryUpdateSummary[]>([])
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

  get updates() {
    return this.#updates
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
    await this.refreshUpdates(editor)
  }

  async refreshUpdates(editor: EditorStore): Promise<void> {
    const summariesById = new Map(
      this.#summaries.value.map((summary) => [summary.libraryId, summary])
    )
    const updates: LibraryUpdateSummary[] = []
    for (const binding of editor.graph.enabledLibraries.values()) {
      if (!binding.enabled) continue
      const latestId = summariesById.get(binding.libraryId)?.latestRevisionId
      if (!latestId || latestId === binding.revisionId) continue
      const current = await this.#getRevision(binding.libraryId, binding.revisionId)
      const latest = await this.#getRevision(binding.libraryId, latestId)
      const summary = summarizeLibraryUpdate(current, latest)
      if (summary) updates.push(summary)
    }
    this.#updates.value = updates
  }

  async applyUpdate(editor: EditorStore, libraryId: string): Promise<void> {
    const update = this.#updates.value.find((item) => item.libraryId === libraryId)
    if (!update) return
    const current = await this.#getRevision(libraryId, update.currentRevisionId)
    const latest = await this.#getRevision(libraryId, update.latestRevisionId)
    const previousAssetKeys = new Set(current.manifest.assets.map((asset) => asset.key))
    const updatable = latest.manifest.assets.filter((asset) => previousAssetKeys.has(asset.key))
    for (const asset of updatable) materializeLibraryAsset(editor.graph, latest, asset.key)
    const plans = planLibraryInstanceUpdates(
      editor.graph,
      libraryId,
      update.currentRevisionId,
      update.latestRevisionId,
      updatable
    )
    for (const plan of plans) {
      editor.graph.swapInstanceComponent(plan.instanceId, plan.componentId)
      reapplyInstanceComponentProperties(editor, plan.instanceId)
    }
    editor.graph.enabledLibraries.set(libraryId, {
      libraryId,
      revisionId: update.latestRevisionId,
      enabled: true
    })
    editor.requestRender()
    await this.refresh(editor)
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
