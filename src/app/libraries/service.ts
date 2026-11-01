import { markRaw, shallowRef } from 'vue'

import { reapplyInstanceComponentProperties } from '@open-pencil/core'
import {
  materializeLibraryAsset,
  ensureLibraryAssetKeys,
  libraryUpdateImpact,
  libraryIdentityForComponent,
  planOutdatedLibraryInstances,
  planLibraryInstanceUpdates,
  summarizeLibraryUpdate,
  updateLibraryDefinitions,
  createSelectiveLibraryRevision,
  discoverPublishableLibraryChanges,
  readSourceLibraryPublication,
  writeSourceLibraryPublication,
  type ComponentLibraryRevision,
  type LibraryCatalog,
  type LibraryDefinitionUpdate,
  type LibrarySummary,
  type LibraryUpdateImpact,
  type LibraryUpdateSummary,
  type PublishLibraryInput,
  type LibraryAssetChange
} from '@open-pencil/core/library'
import type {
  ComponentCatalog,
  ComponentCatalogInsertInput,
  ComponentCatalogLibraryAsset
} from '@open-pencil/core/tools'
import { captureGraphCheckpoint } from '@open-pencil/scene-graph/checkpoint'

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
    if (!this.#updates.value.some((update) => update.libraryId === libraryId)) return
    await this.#updateInPlace(editor, new Map([[libraryId, undefined]]), 'Update library')
  }

  async applyInstanceUpdate(editor: EditorStore, instanceId: string): Promise<void> {
    const instance = editor.graph.getNode(instanceId)
    const component =
      instance?.type === 'INSTANCE' && instance.componentId
        ? editor.graph.getNode(instance.componentId)
        : null
    const identity = component ? libraryIdentityForComponent(editor.graph, component.id) : null
    if (!component || !identity) return
    const summary = this.#summaries.value.find((item) => item.libraryId === identity.libraryId)
    if (!summary || summary.latestRevisionId === identity.revisionId) return
    const latest = await this.#getRevision(identity.libraryId, summary.latestRevisionId)
    this.#materializeAsset(editor, latest, identity.assetKey)
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
        const identity = libraryIdentityForComponent(editor.graph, node.componentId)
        if (identity?.libraryId !== summary.libraryId) continue
        if (identity.revisionId === summary.latestRevisionId) continue
        const { assetKey } = identity
        const latestAsset = assets.get(assetKey)
        if (!latestAsset) continue
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

  async applyAllUpdates(editor: EditorStore): Promise<void> {
    const libraries = this.#updates.value.map((update) => [update.libraryId, undefined] as const)
    await this.#updateInPlace(editor, new Map(libraries), 'Update all library assets')
  }

  async applyUpdateGroups(
    editor: EditorStore,
    groups: LibraryAssetUpdateGroup[],
    label = 'Update library assets'
  ): Promise<void> {
    // A group holds every instance of its asset, so its definitions are redrawn in place.
    const assetKeys = new Map<string, Set<string>>()
    for (const group of groups) {
      const keys = assetKeys.get(group.libraryId) ?? new Set<string>()
      assetKeys.set(group.libraryId, keys.add(group.assetKey))
    }
    await this.#updateInPlace(editor, assetKeys, label)
  }

  async applyInstanceIdsUpdate(
    editor: EditorStore,
    libraryId: string,
    assetKey: string,
    instanceIds: string[],
    label = 'Update library instances'
  ): Promise<void> {
    const latest = await this.#getRevision(libraryId)
    this.#materializeAsset(editor, latest, assetKey)
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
    this.#materializeAsset(editor, latest, assetKey)
    const plans = planOutdatedLibraryInstances(editor.graph, latest, new Set([assetKey]))
    if (plans.length === 0) return
    this.#applyPlans(editor, plans, 'Update library asset')
    await this.refresh(editor)
  }

  /**
   * Redraws the document's definitions of each library, or only those of the given assets, at the
   * library's latest revision in place, so every instance, and every copy of one inside a
   * component, keeps its overrides. Undo puts the document back as it was, and redo as the update
   * left it, so the layers it added keep their IDs for the edits redone after it.
   */
  async #updateInPlace(
    editor: EditorStore,
    libraries: ReadonlyMap<string, ReadonlySet<string> | undefined>,
    label: string
  ): Promise<void> {
    const updates: { revision: ComponentLibraryRevision; assetKeys?: ReadonlySet<string> }[] = []
    for (const [libraryId, assetKeys] of libraries)
      updates.push({ revision: await this.#getRevision(libraryId), assetKeys })
    if (updates.length === 0) return
    const before = captureGraphCheckpoint(editor.graph)
    editor.updateEnabledLibraries(() => {
      for (const { revision, assetKeys } of updates) {
        const update = updateLibraryDefinitions(editor.graph, revision, { assetKeys })
        if (update.replaced.length > 0) this.#replaceDefinitions(editor, revision, update)
      }
    })
    const after = captureGraphCheckpoint(editor.graph)
    editor.requestRender()
    const restore = (checkpoint: typeof before) => () => {
      checkpoint.restore()
      editor.refreshDocumentSettings()
    }
    editor.pushUndoEntry({ label, forward: restore(after), inverse: restore(before) })
    await this.refresh(editor)
  }

  /**
   * Moves the instances of the assets a revision draws as another kind of layer, whose definitions
   * cannot be redrawn in place, to a copy of the revision's, as updating instance by instance does.
   * The document stays on its revision while the update leaves other definitions behind.
   */
  #replaceDefinitions(
    editor: EditorStore,
    revision: ComponentLibraryRevision,
    { replaced, behind }: LibraryDefinitionUpdate
  ): void {
    const { libraryId } = revision.manifest
    const binding = editor.graph.enabledLibraries.get(libraryId)
    for (const assetKey of replaced) materializeLibraryAsset(editor.graph, revision, assetKey)
    this.#swap(editor, planOutdatedLibraryInstances(editor.graph, revision, new Set(replaced)))
    if (behind.length > 0 && binding) editor.graph.enabledLibraries.set(libraryId, binding)
  }

  #swap(editor: EditorStore, swaps: { instanceId: string; componentId: string }[]): void {
    for (const { instanceId, componentId } of swaps) {
      editor.graph.swapInstanceComponent(instanceId, componentId)
      reapplyInstanceComponentProperties(editor, instanceId)
    }
  }

  #applyPlans(
    editor: EditorStore,
    plans: ReturnType<typeof planOutdatedLibraryInstances>,
    label: string
  ): void {
    const apply = () => {
      this.#swap(editor, plans)
      editor.requestRender()
    }
    const restore = () => {
      this.#swap(
        editor,
        plans.map((plan) => ({
          instanceId: plan.instanceId,
          componentId: plan.previousComponentId
        }))
      )
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
    editor.updateEnabledLibraries((bindings) =>
      bindings.set(libraryId, {
        libraryId,
        revisionId: revision.manifest.revisionId,
        enabled: true
      })
    )
    await this.refresh(editor)
  }

  async disable(editor: EditorStore, libraryId: string): Promise<void> {
    editor.updateEnabledLibraries((bindings) => {
      const binding = bindings.get(libraryId)
      if (binding) bindings.set(libraryId, { ...binding, enabled: false })
    })
    await this.refresh(editor)
  }

  async materialize(editor: EditorStore, libraryId: string, revisionId: string, assetKey: string) {
    const revision = await this.#getRevision(libraryId, revisionId)
    const result = this.#materializeAsset(editor, revision, assetKey)
    editor.requestRender()
    return result
  }

  /** Copies a library asset into the document, which enables its library, and announces that. */
  #materializeAsset(
    editor: EditorStore,
    revision: Parameters<typeof materializeLibraryAsset>[1],
    assetKey: string
  ) {
    return editor.updateEnabledLibraries(() =>
      materializeLibraryAsset(editor.graph, revision, assetKey)
    )
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
