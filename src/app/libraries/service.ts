import { markRaw, shallowRef } from 'vue'

import { fittedLayerRenderer, renderNodesToImage } from '@open-pencil/core/io/formats/raster'
import {
  materializeLibraryAsset,
  ensureLibraryAssetKeys,
  isLibraryComponentAsset,
  LIBRARY_THUMBNAIL_SIZE,
  libraryUpdateImpact,
  publishableLibraryAssets,
  libraryIdentityForComponent,
  planOutdatedLibraryInstances,
  planLibraryInstanceUpdates,
  summarizeLibraryUpdate,
  createSelectiveLibraryRevision,
  discoverPublishableLibraryChanges,
  readSourceLibraryPublication,
  writeSourceLibraryPublication,
  type ComponentLibraryRevision,
  type LibraryCatalog,
  type LibrarySummary,
  type LibraryUpdateImpact,
  type LibraryUpdateSummary,
  type PublishLibraryInput,
  type LibraryAssetChange,
  type LibraryThumbnailRenderer
} from '@open-pencil/core/library'
import type {
  ComponentCatalog,
  ComponentCatalogInsertInput,
  ComponentCatalogLibraryAsset
} from '@open-pencil/core/tools'

import { getActiveEditorStoreOrNull } from '@/app/editor/active-store'
import type { EditorStore } from '@/app/editor/session'
import { LocalLibraryCatalog } from '@/app/libraries/catalog/local'
import { RoutedLibraryCatalog, type LibraryCatalogSource } from '@/app/libraries/catalog/routed'
import {
  readLibraryPriority,
  writeLibraryCatalogSource,
  writeLibraryPriority
} from '@/app/libraries/preferences'
import {
  applyLibraryInstancePlans,
  updateLibraryDefinitionsInPlace
} from '@/app/libraries/updates/apply'
import {
  collectLibraryUpdateGroups,
  type LibraryAssetUpdateGroup,
  type LibraryRevisionReader
} from '@/app/libraries/updates/groups'

export type EnabledLibraryAsset = ComponentCatalogLibraryAsset

/** Draws published components with the editor's canvas renderer, once it has one. */
function libraryThumbnailRenderer(editor: EditorStore): LibraryThumbnailRenderer | undefined {
  const { renderer } = editor
  if (!renderer) return undefined
  return fittedLayerRenderer(
    (graph, pageId, nodeIds, { scale }) =>
      renderNodesToImage(renderer.ck, renderer, graph, pageId, nodeIds, { scale, format: 'PNG' }),
    LIBRARY_THUMBNAIL_SIZE
  )
}

export class LibraryService implements ComponentCatalog {
  readonly #catalog: LibraryCatalog
  readonly #routedCatalog: RoutedLibraryCatalog | null
  readonly #summaries = shallowRef<LibrarySummary[]>([])
  readonly #enabledAssets = shallowRef<EnabledLibraryAsset[]>([])
  readonly #updates = shallowRef<LibraryUpdateSummary[]>([])
  readonly #watched = new WeakSet<EditorStore>()
  /** Counts reads of a document's libraries, so one finishing after a newer one is dropped. */
  #reads = 0
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
          .filter(isLibraryComponentAsset)
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
    this.#watch(editor)
    const read = ++this.#reads
    const summaries = await this.#catalog.listLibraries()
    if (read !== this.#reads) return
    this.#summaries.value = summaries
    const assets: EnabledLibraryAsset[] = []
    for (const binding of editor.graph.enabledLibraries.values()) {
      if (!binding.enabled) continue
      const revision = await this.#getRevision(binding.libraryId, binding.revisionId)
      assets.push(
        ...revision.manifest.assets.filter(isLibraryComponentAsset).map((asset) => ({
          libraryId: binding.libraryId,
          libraryName: revision.manifest.name,
          revisionId: binding.revisionId,
          asset,
          enabled: true,
          priority: readLibraryPriority(binding.libraryId)
        }))
      )
    }
    if (read !== this.#reads) return
    this.#enabledAssets.value = assets
    await this.refreshUpdates(editor)
  }

  /**
   * Keeps what the service holds of `editor`'s libraries current when they change outside it, as
   * undo and redo of an update change them; an insert would otherwise take the revision undone.
   * The service shows one document, so a tab in the background does not replace it.
   */
  #watch(editor: EditorStore): void {
    if (this.#watched.has(editor)) return
    this.#watched.add(editor)
    editor.onEditorEvent('document:libraries-changed', () => {
      if (editor !== getActiveEditorStoreOrNull()) return
      // A read that fails here is reported by the next one the manager makes.
      this.refresh(editor).catch(() => undefined)
    })
  }

  async refreshUpdates(editor: EditorStore): Promise<void> {
    const read = ++this.#reads
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
    if (read !== this.#reads) return
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
    await this.#applyOutdated(
      editor,
      latest,
      identity.assetKey,
      new Set([instanceId]),
      `Update ${component.name}`
    )
  }

  async getRevision(libraryId: string, revisionId?: string): Promise<ComponentLibraryRevision> {
    return this.#getRevision(libraryId, revisionId)
  }

  async getUpdateGroups(editor: EditorStore): Promise<LibraryAssetUpdateGroup[]> {
    return collectLibraryUpdateGroups(editor, this.#summaries.value, this.#readRevision)
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
    await this.#applyOutdated(editor, latest, assetKey, new Set(instanceIds), label)
  }

  async applyAssetUpdate(editor: EditorStore, libraryId: string, assetKey: string): Promise<void> {
    const summary = this.#summaries.value.find((item) => item.libraryId === libraryId)
    if (!summary) return
    const latest = await this.#getRevision(libraryId, summary.latestRevisionId)
    await this.#applyOutdated(editor, latest, assetKey, undefined, 'Update library asset')
  }

  /** Redraws library definitions in place (see `updateLibraryDefinitionsInPlace`). */
  async #updateInPlace(
    editor: EditorStore,
    libraries: ReadonlyMap<string, ReadonlySet<string> | undefined>,
    label: string
  ): Promise<void> {
    if (await updateLibraryDefinitionsInPlace(editor, libraries, label, this.#readRevision)) {
      await this.refresh(editor)
    }
  }

  /**
   * Copies `assetKey` from `latest` into the document and swaps its outdated instances, or only
   * `instanceIds` among them, to it as one undoable step.
   */
  async #applyOutdated(
    editor: EditorStore,
    latest: ComponentLibraryRevision,
    assetKey: string,
    instanceIds: ReadonlySet<string> | undefined,
    label: string
  ): Promise<void> {
    this.#materializeAsset(editor, latest, assetKey)
    const plans = planOutdatedLibraryInstances(
      editor.graph,
      latest,
      new Set([assetKey]),
      instanceIds
    )
    if (plans.length === 0) return
    applyLibraryInstancePlans(editor, plans, label)
    await this.refresh(editor)
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
        assetIds: revision.manifest.assets.map((asset) => asset.sourceId),
        keepLayerIdentities: true,
        previousRevisionId: revision.manifest.previousRevisionId,
        description: revision.manifest.description,
        publishedAt: revision.manifest.publishedAt,
        renderThumbnail: libraryThumbnailRenderer(editor)
      })
    } else {
      revision = await this.publish({
        libraryId: input.libraryId,
        name: input.name,
        graph: editor.graph,
        description: input.description,
        assetIds: publishableLibraryAssets(editor.graph)
          .filter((asset) => input.selectedAssetKeys.has(asset.key))
          .map((asset) => asset.sourceId),
        renderThumbnail: libraryThumbnailRenderer(editor)
      })
    }
    writeSourceLibraryPublication(editor.graph, {
      libraryId: revision.manifest.libraryId,
      revisionId: revision.manifest.revisionId,
      name: revision.manifest.name,
      catalogSource: this.catalogSource
    })
    this.#cacheRevision(revision)
    this.#summaries.value = await this.#catalog.listLibraries()
    return revision
  }

  async publish(input: PublishLibraryInput): Promise<ComponentLibraryRevision> {
    ensureLibraryAssetKeys(input.graph, input.assetIds)
    const revision = await this.#catalog.publishRevision(input)
    this.#cacheRevision(revision)
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
    this.#cacheRevision(revision)
    return revision
  }

  #cacheRevision(revision: ComponentLibraryRevision): void {
    this.#revisionCache.set(
      this.#revisionCacheKey(revision.manifest.libraryId, revision.manifest.revisionId),
      revision
    )
  }

  /** `#getRevision` bound to this service, for the update modules that read revisions. */
  readonly #readRevision: LibraryRevisionReader = (libraryId, revisionId) =>
    this.#getRevision(libraryId, revisionId)
}

let service: LibraryService | undefined

export function useLibraryService(): LibraryService {
  service ??= new LibraryService()
  return service
}
