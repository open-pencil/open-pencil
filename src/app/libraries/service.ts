import { markRaw, shallowRef } from 'vue'

import { reapplyInstanceComponentProperties } from '@open-pencil/core/editor'
import {
  materializeLibraryAsset,
  ensureLibraryAssetKeys,
  libraryUpdateImpact,
  planLibraryInstanceUpdates,
  summarizeLibraryUpdate
} from '@open-pencil/core/library'
import type {
  ComponentLibraryRevision,
  LibraryCatalog,
  LibrarySummary,
  LibraryUpdateImpact,
  LibraryUpdateSummary,
  PublishLibraryInput
} from '@open-pencil/core/library'
import type {
  ComponentCatalog,
  ComponentCatalogInsertInput,
  ComponentCatalogLibraryAsset
} from '@open-pencil/core/tools'

import type { EditorStore } from '@/app/editor/session'
import { LocalLibraryCatalog } from '@/app/libraries/catalog/local'
import { RoutedLibraryCatalog, type LibraryCatalogSource } from '@/app/libraries/catalog/routed'

export type EnabledLibraryAsset = ComponentCatalogLibraryAsset

export class LibraryService implements ComponentCatalog {
  readonly #catalog: LibraryCatalog
  readonly #routedCatalog: RoutedLibraryCatalog | null
  readonly #summaries = shallowRef<LibrarySummary[]>([])
  readonly #enabledAssets = shallowRef<EnabledLibraryAsset[]>([])
  readonly #updates = shallowRef<LibraryUpdateSummary[]>([])
  readonly #updateImpacts = shallowRef(new Map<string, LibraryUpdateImpact>())
  readonly #revisionCache = new Map<string, ComponentLibraryRevision>()
  readonly #priorities = new Map<string, number>()
  #activeEditor: EditorStore | null = null

  constructor(catalog?: LibraryCatalog) {
    if (catalog) {
      this.#catalog = markRaw(catalog)
      this.#routedCatalog = catalog instanceof RoutedLibraryCatalog ? catalog : null
    } else {
      const routed = new RoutedLibraryCatalog(new LocalLibraryCatalog())
      this.#catalog = markRaw(routed)
      this.#routedCatalog = routed
    }
  }

  get catalogSource(): LibraryCatalogSource {
    return this.#routedCatalog?.source ?? 'local'
  }

  useLocalCatalog(): void {
    this.#routedCatalog?.useLocal()
  }

  useStorageCatalog(catalog: LibraryCatalog): void {
    this.#routedCatalog?.useStorage(catalog)
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

  get updateImpacts() {
    return this.#updateImpacts
  }

  async listLibraries(): Promise<LibrarySummary[]> {
    this.#summaries.value = await this.#catalog.listLibraries()
    return this.#summaries.value
  }

  async listComponents(input: {
    name?: string
    libraryId?: string
    enabledOnly?: boolean
  }): Promise<EnabledLibraryAsset[]> {
    const normalizedName = input.name?.trim().toLowerCase()
    const libraries = await this.#catalog.listLibraries()
    const assets: EnabledLibraryAsset[] = []
    for (const summary of libraries) {
      if (input.libraryId && input.libraryId !== summary.libraryId) continue
      const revision = await this.#getRevision(summary.libraryId, summary.latestRevisionId)
      const binding = this.#activeEditor?.graph.enabledLibraries.get(summary.libraryId)
      if (input.enabledOnly && !binding?.enabled) continue
      assets.push(
        ...revision.manifest.assets
          .filter((asset) => !normalizedName || asset.name.toLowerCase().includes(normalizedName))
          .map((asset) => ({
            libraryId: summary.libraryId,
            libraryName: summary.name,
            revisionId: revision.manifest.revisionId,
            asset,
            enabled: binding?.enabled ?? false,
            priority: this.#priorities.get(summary.libraryId) ?? 0
          }))
      )
    }
    return assets.sort((left, right) => right.priority - left.priority)
  }

  setPriority(libraryId: string, priority: number): void {
    this.#priorities.set(libraryId, priority)
  }

  bindEditor(editor: EditorStore): void {
    this.#activeEditor = editor
  }

  async insertComponent(
    input: ComponentCatalogInsertInput
  ): Promise<{ id: string; componentId: string }> {
    const editor = this.#activeEditor
    if (!editor) throw new Error('No active editor is bound to the library catalog')
    const revisionId =
      input.revisionId ?? editor.graph.enabledLibraries.get(input.libraryId)?.revisionId
    if (!revisionId) throw new Error(`Library is not enabled: ${input.libraryId}`)
    const materialized = await this.materialize(editor, input.libraryId, revisionId, input.assetKey)
    let componentId = materialized.componentId
    if (input.variantValues && materialized.componentSetId) {
      const match = editor.findVariantByValues(materialized.componentSetId, input.variantValues)
      if (match) componentId = match.id
    }
    const parentId = input.parentId ?? editor.state.currentPageId
    const id = editor.createInstanceFromComponent(componentId, input.x, input.y, parentId)
    if (!id) throw new Error(`Failed to insert library component: ${input.assetKey}`)
    editor.requestRender()
    return { id, componentId }
  }

  async refresh(editor: EditorStore): Promise<void> {
    this.#activeEditor = editor
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
          asset,
          enabled: true,
          priority: this.#priorities.get(binding.libraryId) ?? 0
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
    const impacts = new Map<string, LibraryUpdateImpact>()
    for (const binding of editor.graph.enabledLibraries.values()) {
      if (!binding.enabled) continue
      const latestId = summariesById.get(binding.libraryId)?.latestRevisionId
      if (!latestId || latestId === binding.revisionId) continue
      const current = await this.#getRevision(binding.libraryId, binding.revisionId)
      const latest = await this.#getRevision(binding.libraryId, latestId)
      const summary = summarizeLibraryUpdate(current, latest)
      if (summary) {
        updates.push(summary)
        const commonAssets = latest.manifest.assets.filter((asset) =>
          current.manifest.assets.some((previous) => previous.key === asset.key)
        )
        const plans = planLibraryInstanceUpdates(
          editor.graph,
          binding.libraryId,
          binding.revisionId,
          latestId,
          commonAssets
        )
        impacts.set(binding.libraryId, libraryUpdateImpact(plans))
      }
    }
    this.#updates.value = updates
    this.#updateImpacts.value = impacts
  }

  async applyUpdate(editor: EditorStore, libraryId: string): Promise<void> {
    const update = this.#updates.value.find((item) => item.libraryId === libraryId)
    if (!update) return
    const current = await this.#getRevision(libraryId, update.currentRevisionId)
    const latest = await this.#getRevision(libraryId, update.latestRevisionId)
    const previousAssetKeys = new Set(current.manifest.assets.map((asset) => asset.key))
    const updatable = latest.manifest.assets.filter((asset) => previousAssetKeys.has(asset.key))
    const previousBinding = editor.graph.enabledLibraries.get(libraryId)

    let appliedPlans: ReturnType<typeof planLibraryInstanceUpdates> = []
    const applyRevision = () => {
      for (const asset of updatable) materializeLibraryAsset(editor.graph, latest, asset.key)
      appliedPlans = planLibraryInstanceUpdates(
        editor.graph,
        libraryId,
        update.currentRevisionId,
        update.latestRevisionId,
        updatable
      )
      for (const plan of appliedPlans) {
        editor.graph.swapInstanceComponent(plan.instanceId, plan.componentId)
        reapplyInstanceComponentProperties(editor, plan.instanceId)
      }
      editor.graph.enabledLibraries.set(libraryId, {
        libraryId,
        revisionId: update.latestRevisionId,
        enabled: true
      })
      editor.requestRender()
    }
    const restorePrevious = () => {
      for (const plan of appliedPlans) {
        editor.graph.swapInstanceComponent(plan.instanceId, plan.previousComponentId)
        reapplyInstanceComponentProperties(editor, plan.instanceId)
      }
      const latestRoots = [...editor.graph.getAllNodes()].filter((node) => {
        const identity = node.librarySource?.identity
        if (identity?.libraryId !== libraryId || identity.revisionId !== update.latestRevisionId)
          return false
        const parent = node.parentId ? editor.graph.getNode(node.parentId) : undefined
        return parent?.librarySource?.identity.revisionId !== update.latestRevisionId
      })
      for (const root of latestRoots) editor.graph.deleteNode(root.id)
      if (previousBinding) editor.graph.enabledLibraries.set(libraryId, previousBinding)
      else editor.graph.enabledLibraries.delete(libraryId)
      editor.requestRender()
    }

    applyRevision()
    editor.pushUndoEntry({
      label: 'Update library',
      forward: applyRevision,
      inverse: restorePrevious
    })
    await this.refresh(editor)
  }

  async publish(input: PublishLibraryInput): Promise<ComponentLibraryRevision> {
    ensureLibraryAssetKeys(input.graph, input.assetNodeIds)
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
