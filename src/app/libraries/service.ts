import { markRaw, shallowRef } from 'vue'

import { reapplyInstanceComponentProperties } from '@open-pencil/core/editor'
import {
  materializeLibraryAsset,
  ensureLibraryAssetKeys,
  libraryUpdateImpact,
  libraryAssetKeyForComponent,
  planOutdatedLibraryInstances,
  planLibraryInstanceUpdates,
  summarizeLibraryUpdate,
  createSelectiveLibraryRevision,
  discoverPublishableLibraryChanges,
  readSourceLibraryPublication,
  writeSourceLibraryPublication
} from '@open-pencil/core/library'
import type {
  ComponentLibraryRevision,
  LibraryCatalog,
  LibrarySummary,
  LibraryUpdateImpact,
  LibraryUpdateSummary,
  PublishLibraryInput,
  LibraryAssetChange
} from '@open-pencil/core/library'
import type {
  ComponentCatalog,
  ComponentCatalogInsertInput,
  ComponentCatalogLibraryAsset
} from '@open-pencil/core/tools'

import type { EditorStore } from '@/app/editor/session'
import { LocalLibraryCatalog } from '@/app/libraries/catalog/local'
import { RoutedLibraryCatalog, type LibraryCatalogSource } from '@/app/libraries/catalog/routed'
import {
  readLibraryPriority,
  writeLibraryCatalogSource,
  writeLibraryPriority
} from '@/app/libraries/preferences'
import type { LibraryAssetUpdateGroup } from '@/app/libraries/update-groups'

export type EnabledLibraryAsset = ComponentCatalogLibraryAsset

export class LibraryService implements ComponentCatalog {
  readonly #catalog: LibraryCatalog
  readonly #routedCatalog: RoutedLibraryCatalog | null
  readonly #summaries = shallowRef<LibrarySummary[]>([])
  readonly #enabledAssets = shallowRef<EnabledLibraryAsset[]>([])
  readonly #updates = shallowRef<LibraryUpdateSummary[]>([])
  readonly #updateImpacts = shallowRef(new Map<string, LibraryUpdateImpact>())
  readonly #revisionCache = new Map<string, ComponentLibraryRevision>()
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
    writeLibraryCatalogSource('local')
  }

  useStorageCatalog(catalog: LibraryCatalog): void {
    this.#routedCatalog?.useStorage(catalog)
    writeLibraryCatalogSource('storage')
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
            priority: readLibraryPriority(summary.libraryId)
          }))
      )
    }
    return assets.sort((left, right) => right.priority - left.priority)
  }

  setPriority(libraryId: string, priority: number): void {
    writeLibraryPriority(libraryId, priority)
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
          priority: readLibraryPriority(binding.libraryId)
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
    let createdRootIds: string[] = []
    const applyRevision = () => {
      const existingNodeIds = new Set(editor.graph.nodes.keys())
      for (const asset of updatable) materializeLibraryAsset(editor.graph, latest, asset.key)
      createdRootIds = [...editor.graph.getAllNodes()]
        .filter((node) => {
          if (existingNodeIds.has(node.id)) return false
          const parent = node.parentId ? editor.graph.getNode(node.parentId) : undefined
          return !parent || existingNodeIds.has(parent.id)
        })
        .map((node) => node.id)
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
      for (const rootId of createdRootIds) {
        if (editor.graph.getNode(rootId)) editor.graph.deleteNode(rootId)
      }
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

  async applyInstanceUpdate(editor: EditorStore, instanceId: string): Promise<void> {
    const instance = editor.graph.getNode(instanceId)
    const component =
      instance?.type === 'INSTANCE' && instance.componentId
        ? editor.graph.getNode(instance.componentId)
        : null
    const identity = component?.librarySource?.identity
    if (!identity) return
    const summary = this.#summaries.value.find((item) => item.libraryId === identity.libraryId)
    if (!summary || summary.latestRevisionId === identity.revisionId) return
    const latest = await this.#getRevision(identity.libraryId, summary.latestRevisionId)
    materializeLibraryAsset(editor.graph, latest, identity.assetKey)
    const plans = planOutdatedLibraryInstances(
      editor.graph,
      latest,
      new Set([identity.assetKey]),
      new Set([instanceId])
    )
    if (plans.length === 0) return
    this.#applyPlans(editor, plans, `Update ${component.name}`)
    await this.refresh(editor)
  }

  async getRevision(libraryId: string, revisionId?: string): Promise<ComponentLibraryRevision> {
    return this.#getRevision(libraryId, revisionId)
  }

  async getUpdateGroups(editor: EditorStore): Promise<LibraryAssetUpdateGroup[]> {
    const groups: LibraryAssetUpdateGroup[] = []
    for (const summary of this.#summaries.value) {
      const latest = await this.#getRevision(summary.libraryId, summary.latestRevisionId)
      const assets = new Map(latest.manifest.assets.map((asset) => [asset.key, asset]))
      const previousAssetsByRevision = new Map<string, Map<string, string>>()
      const instancesByAsset = new Map<string, string[]>()
      for (const node of editor.graph.getAllNodes()) {
        if (node.type !== 'INSTANCE' || !node.componentId) continue
        const component = editor.graph.getNode(node.componentId)
        const identity = component?.librarySource?.identity
        if (!component || identity?.libraryId !== summary.libraryId) continue
        if (identity.revisionId === summary.latestRevisionId) continue
        const assetKey = libraryAssetKeyForComponent(editor.graph, component.id)
        const latestAsset = assetKey ? assets.get(assetKey) : undefined
        if (!assetKey || !latestAsset) continue
        let previousAssets = previousAssetsByRevision.get(identity.revisionId)
        if (!previousAssets) {
          const previous = await this.#getRevision(summary.libraryId, identity.revisionId)
          previousAssets = new Map(
            previous.manifest.assets.map((asset) => [asset.key, asset.contentHash])
          )
          previousAssetsByRevision.set(identity.revisionId, previousAssets)
        }
        if (previousAssets.get(assetKey) === latestAsset.contentHash) continue
        const ids = instancesByAsset.get(assetKey) ?? []
        ids.push(node.id)
        instancesByAsset.set(assetKey, ids)
      }
      for (const [assetKey, instanceIds] of instancesByAsset) {
        const asset = assets.get(assetKey)
        if (!asset) continue
        groups.push({
          libraryId: summary.libraryId,
          assetKey,
          name: asset.name,
          instanceIds,
          currentPageCount: instanceIds.length,
          allPagesCount: instanceIds.length
        })
      }
    }
    return groups
  }

  async #plansForGroups(
    editor: EditorStore,
    groups: LibraryAssetUpdateGroup[]
  ): Promise<ReturnType<typeof planOutdatedLibraryInstances>> {
    const plans: ReturnType<typeof planOutdatedLibraryInstances> = []
    for (const group of groups) {
      const latest = await this.#getRevision(group.libraryId)
      materializeLibraryAsset(editor.graph, latest, group.assetKey)
      plans.push(
        ...planOutdatedLibraryInstances(
          editor.graph,
          latest,
          new Set([group.assetKey]),
          new Set(group.instanceIds)
        )
      )
    }
    return plans
  }

  async applyAllUpdates(editor: EditorStore): Promise<void> {
    const groups = await this.getUpdateGroups(editor)
    const plans = await this.#plansForGroups(editor, groups)
    if (plans.length === 0) return
    this.#applyPlans(editor, plans, 'Update all library assets')
    await this.refresh(editor)
  }

  async applyUpdateGroups(
    editor: EditorStore,
    groups: LibraryAssetUpdateGroup[],
    label = 'Update library assets'
  ): Promise<void> {
    const plans = await this.#plansForGroups(editor, groups)
    if (plans.length === 0) return
    this.#applyPlans(editor, plans, label)
    await this.refresh(editor)
  }

  async applyInstanceIdsUpdate(
    editor: EditorStore,
    libraryId: string,
    assetKey: string,
    instanceIds: string[],
    label = 'Update library instances'
  ): Promise<void> {
    const latest = await this.#getRevision(libraryId)
    materializeLibraryAsset(editor.graph, latest, assetKey)
    const plans = planOutdatedLibraryInstances(
      editor.graph,
      latest,
      new Set([assetKey]),
      new Set(instanceIds)
    )
    if (plans.length === 0) return
    this.#applyPlans(editor, plans, label)
    await this.refresh(editor)
  }

  async applyAssetUpdate(editor: EditorStore, libraryId: string, assetKey: string): Promise<void> {
    const summary = this.#summaries.value.find((item) => item.libraryId === libraryId)
    if (!summary) return
    const latest = await this.#getRevision(libraryId, summary.latestRevisionId)
    materializeLibraryAsset(editor.graph, latest, assetKey)
    const plans = planOutdatedLibraryInstances(editor.graph, latest, new Set([assetKey]))
    if (plans.length === 0) return
    this.#applyPlans(editor, plans, 'Update library asset')
    await this.refresh(editor)
  }

  #applyPlans(
    editor: EditorStore,
    plans: ReturnType<typeof planOutdatedLibraryInstances>,
    label: string
  ): void {
    const apply = () => {
      for (const plan of plans) {
        editor.graph.swapInstanceComponent(plan.instanceId, plan.componentId)
        reapplyInstanceComponentProperties(editor, plan.instanceId)
      }
      editor.requestRender()
    }
    const restore = () => {
      for (const plan of plans) {
        editor.graph.swapInstanceComponent(plan.instanceId, plan.previousComponentId)
        reapplyInstanceComponentProperties(editor, plan.instanceId)
      }
      editor.requestRender()
    }
    apply()
    editor.pushUndoEntry({ label, forward: apply, inverse: restore })
  }

  async discoverPublicationChanges(editor: EditorStore): Promise<{
    publication: ReturnType<typeof readSourceLibraryPublication>
    changes: LibraryAssetChange[]
  }> {
    const publication = readSourceLibraryPublication(editor.graph)
    if (!publication) return { publication: null, changes: [] }
    const previous = await this.#getRevision(publication.libraryId, publication.revisionId)
    const { changes } = await discoverPublishableLibraryChanges(previous, editor.graph)
    return { publication, changes }
  }

  async publishSelected(
    editor: EditorStore,
    input: {
      libraryId: string
      name: string
      description?: string
      selectedAssetKeys: ReadonlySet<string>
    }
  ): Promise<ComponentLibraryRevision> {
    const publication = readSourceLibraryPublication(editor.graph)
    let revision: ComponentLibraryRevision
    if (publication) {
      const previous = await this.#getRevision(publication.libraryId, publication.revisionId)
      revision = await createSelectiveLibraryRevision({
        previous,
        sourceGraph: editor.graph,
        selectedAssetKeys: input.selectedAssetKeys,
        name: input.name,
        description: input.description
      })
      revision = await this.#catalog.publishRevision({
        libraryId: revision.manifest.libraryId,
        name: revision.manifest.name,
        graph: revision.graph,
        assetNodeIds: revision.manifest.assets.map((asset) => asset.sourceNodeId),
        previousRevisionId: revision.manifest.previousRevisionId,
        description: revision.manifest.description,
        publishedAt: revision.manifest.publishedAt
      })
    } else {
      revision = await this.publish({
        libraryId: input.libraryId,
        name: input.name,
        graph: editor.graph,
        description: input.description,
        assetNodeIds: [...editor.graph.getAllNodes()]
          .filter(
            (node) =>
              input.selectedAssetKeys.has(node.id) ||
              input.selectedAssetKeys.has(node.componentKey ?? '')
          )
          .map((node) => node.id)
      })
    }
    writeSourceLibraryPublication(editor.graph, {
      libraryId: revision.manifest.libraryId,
      revisionId: revision.manifest.revisionId,
      name: revision.manifest.name,
      catalogSource: this.catalogSource
    })
    this.#revisionCache.set(
      this.#revisionCacheKey(revision.manifest.libraryId, revision.manifest.revisionId),
      revision
    )
    this.#summaries.value = await this.#catalog.listLibraries()
    return revision
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
