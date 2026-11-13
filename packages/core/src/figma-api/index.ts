import type { Image, PageNode, UtilAPI } from '@figma/plugin-typings/plugin-api-standalone'
import { fromUint8Array, isValid, toUint8Array } from 'js-base64'

import type { SceneGraph, SceneNode as CoreSceneNode } from '@open-pencil/scene-graph'
import type { GroupFitOptions } from '@open-pencil/scene-graph/group-bounds'

import type { SkiaRenderer } from '#core/canvas'
import { groupFitOptions } from '#core/canvas/boolean'
import type { InterfaceTheme } from '#core/constants'
import {
  invalidateBooleanAncestors,
  rendererInvalidationForChanges
} from '#core/editor/graph-events'
import { defaultIcons, type IconProvider } from '#core/icons'
import type { RasterCodec } from '#core/io/formats/raster'
import { fontManager } from '#core/text/font/manager'

import { listFigmaFonts } from './fonts/list'
import { loadFigmaFont } from './fonts/load'
import type { FigmaFontNameInput } from './fonts/names'
import { variationAxisTags } from './fonts/variations'
import { bindGraph } from './graph'
import * as images from './images'
import { startPendingLayout } from './pending-layout'
import { flushPendingComponentSync, startPendingComponentSync } from './pending-sync'
import {
  FigmaNodeProxy,
  INTERNAL_ID,
  loadPage,
  MIXED,
  pageOfNode,
  setPageHost,
  type FigmaFont,
  type NodeProxyHost
} from './proxy'
import { FigmaStructureMethods, nodeIdOf, sceneNodeOf } from './structure'
import type { ExportImageOptions } from './types'
import { figmaUtil } from './util'
import { FigmaVariablesAPI } from './variables'
import { detachedViewport, Viewport, type FigmaViewport, type FigmaViewportHost } from './viewport'
import { cancelScriptWaits, waitOutsideScript } from './waits'

const noop = () => undefined

/** What a host passes to `FigmaAPI` beyond the document. */
export interface FigmaAPIOptions {
  /** Fetches the HTTP(S) URLs `figma.createImageAsync` loads; the global `fetch` by default. */
  fetch?: images.ImageFetch
  /**
   * Loads a page's layers, for a host that loads pages as they are visited, as the editor does a
   * file it opens: `page.loadAsync`, `figma.loadAllPagesAsync`, and `setCurrentPageAsync` call
   * it, as they load pages in Figma's dynamic-page mode. Without one every page is in memory.
   */
  loadPage?: (pageId: string) => Promise<void>
  /** The page holding a layer not loaded yet, which `getNodeByIdAsync` loads to find it. */
  pageOfNode?: (nodeId: string) => Promise<string | null>
  /**
   * Cancels the script using this API: once it aborts, a font, image, or page load the script
   * waits on, or starts, rejects with its reason. Code the script runs without waiting goes on.
   */
  signal?: AbortSignal
  /** Reads the fonts the host has installed, before `listAvailableFontsAsync` lists them. */
  prepareFontList?: () => Promise<void>
  /**
   * Brings instances in line with the component edits made so far, for a host that syncs them
   * after edits itself, as the editor does; reading a layer calls it first. Without one the API
   * records edits and syncs their instances itself.
   */
  flushComponentSync?: () => void
  /**
   * The renderer that measures for the API, for a host that already tells its renderers about
   * edits, as the editor does. The API reads it on each use and does not listen to the graph,
   * so an API made for one call holds nothing once the call ends. `setRenderer` replaces it.
   */
  renderer?: () => SkiaRenderer | null
  /**
   * The view of a host that shows the document, which `figma.viewport` reads and moves. Without
   * one nothing shows the document, so the API keeps a center and zoom of its own and fitting
   * layers only centres them: there is no screen to size a zoom to (`detachedViewport`).
   */
  viewport?: FigmaViewportHost
}

export { FigmaNodeProxy } from './proxy'
export { graphOf } from './graph'
export { getPageBackgrounds, setPageBackgrounds } from './page-backgrounds'
export { flushPendingLayout } from './pending-layout'
export { flushPendingComponentSync } from './pending-sync'
export type { FigmaEffect } from './effects'
export type { ExportImageOptions } from './types'
export { MAX_IMAGE_FETCH_BYTES, type ImageFetch } from './images'
export type { FigmaViewport, FigmaViewportHost } from './viewport'
export {
  FigmaVariable,
  FigmaVariableCollection,
  FigmaVariablesAPI,
  type FigmaComposedColor,
  type FigmaVariableAlias,
  type FigmaVariableValue
} from './variables'
export type {
  FigmaBooleanOperationNode,
  FigmaComponentNode,
  FigmaComponentSetNode,
  FigmaConnectorNode,
  FigmaEllipseNode,
  FigmaFrameNode,
  FigmaGroupNode,
  FigmaInstanceNode,
  FigmaLineNode,
  FigmaPolygonNode,
  FigmaRectangleNode,
  FigmaSectionNode,
  FigmaShapeWithTextNode,
  FigmaSlotNode,
  FigmaStarNode,
  FigmaTextNode,
  FigmaVectorNode
} from './node-types'
export type { FigmaFont, FigmaFontName } from './proxy'
export type { FigmaFontNameInput } from './fonts/names'
export type { FigmaVariationSettings } from './fonts/variations'

// TODO(figma-api): Implement the full official PluginAPI interface once our compatibility
// layer covers all required node-specific return types and unsupported APIs are modeled explicitly.
export class FigmaAPI extends FigmaStructureMethods implements NodeProxyHost {
  readonly #graph: SceneGraph
  #currentPageId: string
  /** Counts page switches, so a switch whose page loads after a later one does not undo it. */
  #pageSwitch = 0
  #selection: FigmaNodeProxy[] = []
  #nodeCache = new Map<string, FigmaNodeProxy>()
  #nodeTypes = new Map<string, string | undefined>()
  #pageProxies = new WeakSet<FigmaNodeProxy>()
  #renderer: () => SkiaRenderer | null = () => null
  #unbindRendererEvents: (() => void) | null = null
  /** The interface theme new sections take their fill from, as in Figma. */
  theme: InterfaceTheme = 'light'

  readonly mixed = MIXED
  /** Figma's color and Markdown helpers, as `figma.util`. */
  readonly util: UtilAPI = figmaUtil
  /** The document's variables and collections, as Figma's `figma.variables`. */
  readonly variables: FigmaVariablesAPI

  /** How `createImageAsync` fetches HTTP(S) URLs; a host passes one that gets past CORS. */
  readonly #fetch: images.ImageFetch
  readonly #prepareFontList: (() => Promise<void>) | undefined
  readonly #viewport: Viewport

  constructor(graph: SceneGraph, options: FigmaAPIOptions = {}) {
    super()
    this.#graph = graph
    this.#viewport = new Viewport(
      options.viewport ?? detachedViewport(),
      () => this.#currentPageId,
      (node) => this.wrapNode(nodeIdOf(node)).absoluteBoundingBox
    )
    bindGraph(this, graph)
    this.#fetch = options.fetch ?? ((input, init) => fetch(input, init))
    if (options.signal) cancelScriptWaits(this, options.signal)
    this.#prepareFontList = options.prepareFontList
    if (options.renderer) this.#renderer = options.renderer
    if (options.loadPage)
      setPageHost(this, { load: options.loadPage, pageOfNode: options.pageOfNode })
    this.variables = new FigmaVariablesAPI(graph)
    startPendingComponentSync(graph, options.flushComponentSync)
    startPendingLayout(graph)
    const pages = graph.getPages()
    this.#currentPageId = pages[0]?.id ?? graph.rootId
  }

  get renderer(): SkiaRenderer | null {
    return this.#renderer()
  }

  /**
   * The renderer that measures for the API: geometry, boolean results, and flattened vectors. It
   * keeps paths between readings, so the API tells it when a layer's shape changes or a change
   * lands inside a boolean operation, as the editor does for its renderers. A host whose
   * renderers it already tells passes `FigmaAPIOptions.renderer` instead.
   */
  setRenderer(renderer: SkiaRenderer | null): void {
    this.#unbindRendererEvents?.()
    this.#unbindRendererEvents = null
    this.#renderer = () => renderer
    if (!renderer) return
    const graph = this.#graph
    const invalidate = (id: string | null | undefined) =>
      invalidateBooleanAncestors(graph, [renderer], id)
    // A layer's own paths are kept too, so an edit to its shape drops them, as the editor's do.
    const changed = (id: string, changes: Partial<CoreSceneNode>) => {
      invalidate(id)
      const { geometryCache } = rendererInvalidationForChanges(changes, { preview: false })
      if (geometryCache) renderer.invalidateVectorPath(id)
    }
    this.#unbindRendererEvents = graph.onNodeEvents({
      created: (node) => invalidate(node.parentId),
      updated: (id, changes) => changed(id, changes),
      previewUpdated: (id, changes) => changed(id, changes),
      deleted: (_id, parentId) => invalidate(parentId),
      reparented: (id, oldParentId) => {
        invalidate(oldParentId)
        invalidate(graph.getNode(id)?.parentId)
      },
      reordered: (_id, parentId, _index, previousParentId) => {
        invalidate(parentId)
        invalidate(previousParentId)
      }
    })
  }

  get groupFitOptions(): GroupFitOptions {
    return groupFitOptions(this.#renderer(), this.#graph)
  }

  get currentPageId(): string {
    return this.#currentPageId
  }

  wrapNode(id: string): FigmaNodeProxy {
    const type = this.#graph.getNode(id)?.type
    let proxy = this.#nodeCache.get(id)
    // A node that changed type, such as a detached instance, gets the members of its new type.
    if (!proxy || this.#nodeTypes.get(id) !== type) {
      proxy = new FigmaNodeProxy(id, this.#graph, this)
      this.#nodeCache.set(id, proxy)
      this.#nodeTypes.set(id, type)
    }
    return proxy
  }

  #ensurePageProxy(proxy: FigmaNodeProxy): FigmaNodeProxy & { selection: FigmaNodeProxy[] } {
    if (!this.#pageProxies.has(proxy)) {
      Object.defineProperty(proxy, 'selection', {
        get: () => this.#selection,
        set: (nodes: FigmaNodeProxy[]) => {
          this.#selection = nodes
        },
        enumerable: true,
        configurable: true
      })
      this.#pageProxies.add(proxy)
    }
    return proxy as FigmaNodeProxy & { selection: FigmaNodeProxy[] }
  }

  get root(): FigmaNodeProxy {
    return this.wrapNode(this.#graph.rootId)
  }

  get currentPage(): FigmaNodeProxy & { selection: FigmaNodeProxy[] } {
    return this.#ensurePageProxy(this.wrapNode(this.#currentPageId))
  }

  set currentPage(page: FigmaNodeProxy) {
    this.#pageSwitch++
    this.#currentPageId = page[INTERNAL_ID]
  }

  getNodeById(id: string): FigmaNodeProxy | null {
    flushPendingComponentSync(this.#graph)
    const node = this.#graph.getNode(id)
    return node ? this.wrapNode(id) : null
  }

  /** The async lookup that Figma requires in dynamic-page mode; same result as getNodeById. */
  /** As in Figma's dynamic-page mode, a layer on a page not loaded yet loads that page. */
  async getNodeByIdAsync(id: string): Promise<FigmaNodeProxy | null> {
    const node = this.getNodeById(id)
    if (node) return node
    const pageId = await pageOfNode(this, id)
    if (!pageId) return null
    await loadPage(this, pageId)
    return this.getNodeById(id)
  }

  /**
   * The page switch Figma requires in dynamic-page mode, which sets `currentPage`. As in Figma, a
   * missing node throws at once and a node that is no page rejects.
   */
  setCurrentPageAsync(page: FigmaNodeProxy): Promise<void>
  setCurrentPageAsync(page: PageNode): Promise<void>
  // Scripts are not type-checked, so the call checks for a missing node as Figma does.
  setCurrentPageAsync(page: PageNode | FigmaNodeProxy | null | undefined): Promise<void> {
    if (page == null) throw new Error(`in setCurrentPageAsync: Expected node, got ${String(page)}`)
    if (sceneNodeOf(this.#graph, page).type !== 'CANVAS') {
      return Promise.reject(new Error('figma.setCurrentPageAsync expects a PageNode'))
    }
    const pageId = nodeIdOf(page)
    const pageSwitch = ++this.#pageSwitch
    return loadPage(this, pageId).then(() => {
      if (pageSwitch !== this.#pageSwitch) return undefined
      if (this.#graph.getNode(pageId)?.type !== 'CANVAS')
        throw new Error('in setCurrentPageAsync: The page was removed while it loaded')
      this.#currentPageId = pageId
      return undefined
    })
  }

  // --- Viewport ---

  get viewport(): FigmaViewport {
    return this.#viewport
  }

  createImage(data: Uint8Array): Image {
    return images.createImage(this.#graph, data)
  }

  getImageByHash(hash: string): Image | null {
    return images.imageByHash(this.#graph, hash)
  }

  /** Fetches the image at `src` through the host's `fetch` and stores it as `createImage` does. */
  createImageAsync(src: string): Promise<Image> {
    return images.fetchImage(this, src, this.#fetch)
  }

  // --- Stubs ---

  /** Loads the font so text measures and draws with it from then on; rejects as Figma does. */
  async loadFontAsync(fontName: FigmaFontNameInput): Promise<void> {
    await waitOutsideScript(this, () => loadFigmaFont(fontName))
  }

  /**
   * The axis tags a variable family takes in `variationSettings`, or `null` for a static family.
   * Figma answers for any family it lists; OpenPencil reads the axes from a file the family has
   * loaded, so a family has to be loaded first.
   */
  getFontFamilyVariationAxes(family: string): string[] | null {
    const variation = fontManager.familyVariation(family)
    if (variation === undefined) {
      throw new Error(
        `in getFontFamilyVariationAxes: Font family "${family}" is not available. Load it with figma.loadFontAsync({ family: "${family}" }) first.`
      )
    }
    return variation ? variationAxisTags(variation.axes) : null
  }

  /** Every face a script can set, by family; see {@link listFigmaFonts}. */
  listAvailableFontsAsync(): Promise<FigmaFont[]> {
    const prepare = this.#prepareFontList
    return waitOutsideScript(this, async () => {
      await prepare?.()
      return listFigmaFonts()
    })
  }

  base64Encode(data: Uint8Array): string {
    return fromUint8Array(data)
  }

  base64Decode(data: string): Uint8Array {
    if (!isValid(data)) throw new TypeError('Invalid Base64 string')
    return toUint8Array(data)
  }

  notify(message: string): { cancel: () => void } {
    if (typeof console !== 'undefined') console.warn(`[figma.notify] ${message}`)
    return { cancel: noop }
  }

  /**
   * A script is one call rather than a plugin with a lifetime, so nothing closes; the message is
   * shown as Figma shows it, through `notify`.
   */
  closePlugin(message?: string): void {
    if (message) this.notify(message)
  }

  /** Loads every page's layers, one page after another, as Figma does in dynamic-page mode. */
  async loadAllPagesAsync(): Promise<void> {
    for (const page of this.#graph.getPages()) await loadPage(this, page.id)
  }

  commitUndo(): void {
    return undefined
  }

  triggerUndo(): void {
    return undefined
  }

  exportImage?: (nodeIds: string[], options: ExportImageOptions) => Promise<Uint8Array | null>
  /** Where icon tools search and fetch icons; hosts may pass a self-hosted or bundled set. */
  icons: IconProvider = defaultIcons
  rasterCodec?: RasterCodec
  /** The document as it was before the current AI run first edited `pageId`, or null if unedited. */
  changeBaseline?: (pageId: string) => SceneGraph | null
}
