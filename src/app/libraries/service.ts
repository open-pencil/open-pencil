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
  type ComponentLibraryManifest,
  type ComponentLibraryRevision,
  type LibrarySummary,
  type LibraryUpdateImpact,
  type LibraryUpdateSummary,
  type PublishLibraryInput,
  type LibraryAssetChange,
  type LibraryThumbnailRenderer
} from '@open-pencil/core/library'
import type { ComponentCatalog } from '@open-pencil/core/tools'
import { appendAll } from '@open-pencil/std/arrays'

import { getActiveEditorStoreOrNull } from '@/app/editor/active-store'
import type { EditorStore } from '@/app/editor/session'
import { MirroredLibraryCatalog, type LibraryCatalogSource } from '@/app/libraries/catalog/mirrored'
import {
  componentCatalogForEditor,
  type EnabledLibraryAsset
} from '@/app/libraries/component-catalog'
import {
  LibraryContentFailedError,
  LibraryContentSyncingError,
  LibraryRevisionMissingError
} from '@/app/libraries/errors'
import {
  readLibraryPriority,
  writeLibraryCatalogSource,
  writeLibraryPriority
} from '@/app/libraries/preferences'
import { kickLibrarySync, whenLibrarySyncReady } from '@/app/libraries/sync/engine'
import { registerNeedsProvider } from '@/app/libraries/sync/needs'
import { libraryResolutionKey, librarySyncResolution } from '@/app/libraries/sync/status'
import {
  applyLibraryInstancePlans,
  updateLibraryDefinitionsInPlace,
  type LibraryRevisionReader
} from '@/app/libraries/updates/apply'
import {
  collectLibraryUpdateGroups,
  type LibraryAssetUpdateGroup
} from '@/app/libraries/updates/groups'

export type { EnabledLibraryAsset }

/** In-memory cap on revisions held by `#getRevision`. */
const REVISION_CACHE_LIMIT = 200

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

export class LibraryService {
  #catalog: MirroredLibraryCatalog
  readonly #summaries = shallowRef<LibrarySummary[]>([])
  readonly #enabledAssets = shallowRef<EnabledLibraryAsset[]>([])
  readonly #updates = shallowRef<LibraryUpdateSummary[]>([])
  readonly #watched = new WeakSet<EditorStore>()
  /** Read counter so a stale read finishing after a newer one is dropped. */
  #reads = 0
  readonly #updateImpacts = shallowRef(new Map<string, LibraryUpdateImpact>())
  readonly #revisionCache = new Map<string, ComponentLibraryRevision>()

  constructor(catalog = MirroredLibraryCatalog.placeholder()) {
    this.#catalog = markRaw(catalog)
  }

  /** Follows the sync engine's remote: each remote identity has its own mirror. */
  attachCatalog(catalog: MirroredLibraryCatalog): void {
    this.#catalog = markRaw(catalog)
    // Reads started against the previous mirror must not publish their results.
    this.#reads += 1
    // Revisions cached from one mirror's rows do not describe the next one's.
    this.#revisionCache.clear()
  }

  get catalogSource(): LibraryCatalogSource {
    return this.#catalog.source
  }

  useLocalCatalog(): void {
    this.#catalog.useLocal()
    writeLibraryCatalogSource('local')
  }

  /** Switches to storage once the engine's first remote rebuild settled, so the mirror is its own. */
  async useStorageCatalog(): Promise<void> {
    await whenLibrarySyncReady()
    this.#catalog.useStorage()
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
    const read = ++this.#reads
    const summaries = await this.#catalog.listLibraries()
    // The caller keeps its rows, but rows of a catalog swapped mid-read must not publish.
    if (read === this.#reads) this.#summaries.value = summaries
    return summaries
  }

  /** The `ComponentCatalog` view of `store`'s document (see `component-catalog.ts`). */
  forEditor(store: EditorStore): ComponentCatalog {
    return componentCatalogForEditor(this, store)
  }

  /**
   * The tolerant manifest read the UI surfaces use: a revision still syncing or parked failed
   * reads as `null`, so the caller skips that library instead of failing the whole list.
   */
  async readManifest(
    libraryId: string,
    revisionId?: string
  ): Promise<ComponentLibraryManifest | null> {
    return this.#readManifest(libraryId, revisionId).catch((error: unknown) => {
      if (
        error instanceof LibraryContentSyncingError ||
        error instanceof LibraryContentFailedError
      ) {
        return null
      }
      throw error
    })
  }

  setPriority(libraryId: string, priority: number): void {
    writeLibraryPriority(libraryId, priority)
  }

  async refresh(editor: EditorStore): Promise<void> {
    this.#watch(editor)
    const read = ++this.#reads
    const summaries = await this.#catalog.listLibraries()
    if (read !== this.#reads) return
    this.#summaries.value = summaries
    const assets: EnabledLibraryAsset[] = []
    for (const binding of editor.graph.enabledLibraries.values()) {
      if (!binding.enabled) continue
      // A bound revision still syncing contributes no assets yet; its row state surfaces
      // through `librarySyncResolution`, not a failed refresh.
      const manifest = await this.readManifest(binding.libraryId, binding.revisionId)
      if (!manifest) continue
      appendAll(
        assets,
        manifest.assets.filter(isLibraryComponentAsset).map((asset) => ({
          libraryId: binding.libraryId,
          libraryName: manifest.name,
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
   * The service shows one document, so a tab in the background does not replace it — but every
   * store it watches still registers with the sync engine, whose needs cover all documents.
   */
  #watch(editor: EditorStore): void {
    registerNeedsProvider(editor)
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
      // Either revision still syncing means the update pair is incomplete; the library keeps
      // its syncing row state instead of failing the whole refresh.
      const [current, latest] = await Promise.all([
        this.readManifest(binding.libraryId, binding.revisionId),
        this.readManifest(binding.libraryId, latestId)
      ])
      if (!current || !latest) continue
      const summary = summarizeLibraryUpdate(current, latest)
      if (summary) {
        updates.push(summary)
        const commonAssets = latest.assets.filter((asset) =>
          current.assets.some((previous) => previous.key === asset.key)
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
    // Update review needs the revisions instances came from, not only the bound ones.
    void kickLibrarySync({ probe: false, includeInstanceRevs: true })
    return collectLibraryUpdateGroups(editor, this.#summaries.value, (libraryId, revisionId) =>
      this.readManifest(libraryId, revisionId)
    )
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
    const readRevision: LibraryRevisionReader = (libraryId, revisionId) =>
      this.#getRevision(libraryId, revisionId)
    if (await updateLibraryDefinitionsInPlace(editor, libraries, label, readRevision)) {
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

  /** Binds the library at `revisionId` or its summary's latest, without reading any content. */
  async enable(editor: EditorStore, libraryId: string, revisionId?: string): Promise<void> {
    // A library the mirror never listed cannot be enabled: the binding would pin a revision
    // nothing can fetch.
    const resolvedRevisionId = revisionId ?? (await this.#findSummary(libraryId))?.latestRevisionId
    if (!resolvedRevisionId) throw new LibraryRevisionMissingError(libraryId)
    // A local publish is complete on write, so a revision the local catalog cannot read must
    // fail before the binding lands — a bad binding would make every later refresh throw.
    // Storage stays content-free: a still-syncing revision binds now and fills in on arrival.
    if (this.catalogSource === 'local') {
      await this.#readManifest(libraryId, resolvedRevisionId)
    }
    editor.updateEnabledLibraries((bindings) =>
      bindings.set(libraryId, {
        libraryId,
        revisionId: resolvedRevisionId,
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

  /** The library's summary row: the service's summaries first, a mirror list as fallback. */
  async #findSummary(libraryId: string): Promise<LibrarySummary | undefined> {
    return (
      this.#summaries.value.find((item) => item.libraryId === libraryId) ??
      (await this.#catalog.listLibraries()).find((item) => item.libraryId === libraryId)
    )
  }

  /**
   * A mirror miss means the engine is still pulling, unless it already marked the revision
   * failed. A miss without an id resolves the summary's latest first.
   */
  async #failedOrRethrow(error: unknown): Promise<never> {
    if (!(error instanceof LibraryContentSyncingError)) throw error
    const revisionId =
      error.revisionId ?? (await this.#findSummary(error.libraryId))?.latestRevisionId
    if (!revisionId) throw error
    const key = libraryResolutionKey(error.libraryId, revisionId)
    if (librarySyncResolution.value.get(key) === 'failed') {
      throw new LibraryContentFailedError(error.libraryId, revisionId)
    }
    throw new LibraryContentSyncingError(error.libraryId, revisionId)
  }

  async #getRevision(libraryId: string, revisionId?: string): Promise<ComponentLibraryRevision> {
    if (revisionId) {
      const cached = this.#revisionCache.get(libraryResolutionKey(libraryId, revisionId))
      if (cached) return cached
    }
    try {
      const catalog = this.#catalog
      const revision = await catalog.getRevision(libraryId, revisionId)
      // A catalog swap mid-read makes this another mirror's revision: the caller still gets
      // it, but it must not enter the new catalog's cache.
      if (this.#catalog === catalog) this.#cacheRevision(revision)
      return revision
    } catch (error) {
      return this.#failedOrRethrow(error)
    }
  }

  /** Reads a manifest without building the graph; a mirror miss throws the syncing/failed error. */
  async #readManifest(libraryId: string, revisionId?: string): Promise<ComponentLibraryManifest> {
    try {
      return await this.#catalog.getManifest(libraryId, revisionId)
    } catch (error) {
      return this.#failedOrRethrow(error)
    }
  }

  #cacheRevision(revision: ComponentLibraryRevision): void {
    this.#revisionCache.set(
      libraryResolutionKey(revision.manifest.libraryId, revision.manifest.revisionId),
      revision
    )
    if (this.#revisionCache.size > REVISION_CACHE_LIMIT) {
      const oldest = this.#revisionCache.keys().next().value
      if (oldest !== undefined) this.#revisionCache.delete(oldest)
    }
  }
}
