import { fromUint8Array, isValid, toUint8Array } from 'js-base64'

import type { SceneGraph, SceneNode as CoreSceneNode, NodeType } from '@open-pencil/scene-graph'
import { createConnector, freeEndpoint } from '@open-pencil/scene-graph/connectors'
import { computeBounds } from '@open-pencil/scene-graph/geometry'
import type { GroupFitOptions } from '@open-pencil/scene-graph/group-bounds'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

import type { SkiaRenderer } from '#core/canvas'
import { groupFitOptions } from '#core/canvas/boolean'
import { IS_BROWSER, type InterfaceTheme } from '#core/constants'
import { invalidateBooleanAncestors } from '#core/editor/graph-events'
import { layerTheme, newLayerDefaults } from '#core/editor/shapes/defaults'
import { booleanOperationPaints, createBooleanOperation } from '#core/editor/structure/boolean'
import { wrapNodes } from '#core/editor/structure/container-wrap'
import { ungroupNode } from '#core/editor/structure/group/ungroup'
import { setDefaultPageBackground } from '#core/figma-api/page-backgrounds'
import { defaultIcons, type IconProvider } from '#core/icons'
import type { RasterCodec } from '#core/io/formats/raster'
import { createSVGNodes } from '#core/io/formats/svg'
import { textAutoResizeChanges } from '#core/layout/text-auto-resize'
import { fontManager } from '#core/text/font/manager'

import { componentFromNode } from './components'
import { flattenSceneNodes } from './flatten'
import { loadFigmaFont } from './fonts/load'
import type { FigmaFontNameInput } from './fonts/names'
import { variationAxisTags } from './fonts/variations'
import * as images from './images'
import type {
  FigmaBooleanOperationNode,
  FigmaComponentNode,
  FigmaComponentSetNode,
  FigmaConnectorNode,
  FigmaEllipseNode,
  FigmaFrameNode,
  FigmaGroupNode,
  FigmaLineNode,
  FigmaPolygonNode,
  FigmaRectangleNode,
  FigmaSectionNode,
  FigmaShapeWithTextNode,
  FigmaStarNode,
  FigmaTextNode,
  FigmaVectorNode
} from './node-types'
import { startPendingLayout } from './pending-layout'
import { FigmaNodeProxy, INTERNAL_ID, MIXED, type FigmaFont, type NodeProxyHost } from './proxy'
import { newShapeWithText } from './shape-with-text'
import type { ExportImageOptions } from './types'
import { figmaUtil } from './util'
import { FigmaVariablesAPI } from './variables'
import { combineComponentsAsVariants } from './variants'

const noop = () => undefined

/** What a host passes to `FigmaAPI` beyond the document. */
export interface FigmaAPIOptions {
  /** Fetches the HTTP(S) URLs `figma.createImageAsync` loads; the global `fetch` by default. */
  fetch?: images.ImageFetch
}

export { FigmaNodeProxy } from './proxy'
export { getPageBackgrounds, setPageBackgrounds } from './page-backgrounds'
export { flushPendingLayout } from './pending-layout'
export type { FigmaEffect } from './effects'
export type { ExportImageOptions } from './types'
export { MAX_IMAGE_FETCH_BYTES, type ImageFetch } from './images'
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
export class FigmaAPI implements NodeProxyHost {
  readonly graph: SceneGraph
  private _currentPageId: string
  private _selection: FigmaNodeProxy[] = []
  private _nodeCache = new Map<string, FigmaNodeProxy>()
  private _pageProxies = new WeakSet<FigmaNodeProxy>()
  private _renderer: SkiaRenderer | null = null
  private _unbindRendererEvents: (() => void) | null = null
  /** The interface theme new sections take their fill from, as in Figma. */
  theme: InterfaceTheme = 'light'

  readonly mixed = MIXED
  /** Figma's color and Markdown helpers, as `figma.util`. */
  readonly util: UtilAPI = figmaUtil
  /** The document's variables and collections, as Figma's `figma.variables`. */
  readonly variables: FigmaVariablesAPI

  /** How `createImageAsync` fetches HTTP(S) URLs; a host passes one that gets past CORS. */
  readonly #fetch: images.ImageFetch

  constructor(graph: SceneGraph, options: FigmaAPIOptions = {}) {
    this.graph = graph
    this.#fetch = options.fetch ?? ((input, init) => fetch(input, init))
    this.variables = new FigmaVariablesAPI(graph)
    startPendingLayout(graph)
    const pages = graph.getPages()
    this._currentPageId = pages[0]?.id ?? graph.rootId
  }

  /**
   * The renderer that measures for the API: boolean results and flattened vectors. It keeps
   * each boolean operation's result between readings, so the API tells it when a change lands
   * inside one, as the editor does for its renderers.
   */
  setRenderer(renderer: SkiaRenderer | null): void {
    this._unbindRendererEvents?.()
    this._unbindRendererEvents = null
    this._renderer = renderer
    if (!renderer) return
    const graph = this.graph
    const invalidate = (id: string | null | undefined) =>
      invalidateBooleanAncestors(graph, [renderer], id)
    this._unbindRendererEvents = graph.onNodeEvents({
      created: (node) => invalidate(node.parentId),
      updated: (id) => invalidate(id),
      previewUpdated: (id) => invalidate(id),
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
    return groupFitOptions(this._renderer, this.graph)
  }

  get currentPageId(): string {
    return this._currentPageId
  }

  wrapNode(id: string): FigmaNodeProxy {
    let proxy = this._nodeCache.get(id)
    if (!proxy) {
      proxy = new FigmaNodeProxy(id, this.graph, this)
      this._nodeCache.set(id, proxy)
    }
    return proxy
  }

  private _ensurePageProxy(
    proxy: FigmaNodeProxy
  ): FigmaNodeProxy & { selection: FigmaNodeProxy[] } {
    if (!this._pageProxies.has(proxy)) {
      Object.defineProperty(proxy, 'selection', {
        get: () => this._selection,
        set: (nodes: FigmaNodeProxy[]) => {
          this._selection = nodes
        },
        enumerable: true,
        configurable: true
      })
      this._pageProxies.add(proxy)
    }
    return proxy as FigmaNodeProxy & { selection: FigmaNodeProxy[] }
  }

  get root(): FigmaNodeProxy {
    return this.wrapNode(this.graph.rootId)
  }

  get currentPage(): FigmaNodeProxy & { selection: FigmaNodeProxy[] } {
    return this._ensurePageProxy(this.wrapNode(this._currentPageId))
  }

  set currentPage(page: FigmaNodeProxy) {
    this._currentPageId = page[INTERNAL_ID]
  }

  getNodeById(id: string): FigmaNodeProxy | null {
    const node = this.graph.getNode(id)
    return node ? this.wrapNode(id) : null
  }

  /** The async lookup that Figma requires in dynamic-page mode; same result as getNodeById. */
  async getNodeByIdAsync(id: string): Promise<FigmaNodeProxy | null> {
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
    if (this._rawNode(page).type !== 'CANVAS') {
      return Promise.reject(new Error('figma.setCurrentPageAsync expects a PageNode'))
    }
    this._currentPageId = this._nodeId(page)
    return Promise.resolve()
  }

  // --- Node Creation ---

  /** New layers start as the editor's tools make them, which is how Figma's plugin API makes them. */
  private _createNode(type: NodeType): FigmaNodeProxy {
    // A board's new sections are light under any interface theme, as the editor makes them.
    const theme = layerTheme({ documentKind: this.graph.documentKind, theme: this.theme })
    const defaults = newLayerDefaults(type, theme)
    // Figma's plugin API makes a line with no height, a 496 px section, and a hugging frame.
    if (type === 'LINE') defaults.height = 0
    if (type === 'SECTION') Object.assign(defaults, { width: 496, height: 496 })
    if (type === 'FRAME' || type === 'COMPONENT') defaults.primaryAxisSizing = 'HUG'
    const node = this.graph.createNode(type, this._currentPageId, defaults)
    return this.wrapNode(node.id)
  }

  createFrame(): FigmaFrameNode {
    return this._createNode('FRAME') as FigmaFrameNode
  }

  createRectangle(): FigmaRectangleNode {
    return this._createNode('RECTANGLE') as FigmaRectangleNode
  }

  createEllipse(): FigmaEllipseNode {
    return this._createNode('ELLIPSE') as FigmaEllipseNode
  }

  createText(): FigmaTextNode {
    const text = this._createNode('TEXT') as FigmaTextNode
    // Figma's plugin text starts empty at 12px and sizes itself to its content: no width, one
    // line tall.
    const node = this.graph.getNode(text.id)
    const defaults = { fontSize: 12, textAutoResize: 'WIDTH_AND_HEIGHT' as const, width: 0 }
    this.graph.updateNode(text.id, { ...defaults, ...textAutoResizeChanges(node, defaults) })
    return text
  }

  createLine(): FigmaLineNode {
    return this._createNode('LINE') as FigmaLineNode
  }

  createPolygon(): FigmaPolygonNode {
    return this._createNode('POLYGON') as FigmaPolygonNode
  }

  createStar(): FigmaStarNode {
    return this._createNode('STAR') as FigmaStarNode
  }

  createShapeWithText(): FigmaShapeWithTextNode {
    return this.wrapNode(newShapeWithText(this).id) as FigmaShapeWithTextNode
  }

  createVector(): FigmaVectorNode {
    return this._createNode('VECTOR') as FigmaVectorNode
  }

  /** The layers Figma makes from SVG markup, on the current page at its origin. */
  // eslint-disable-next-line open-pencil/no-mixed-case-acronym-identifiers -- Figma Plugin API name.
  createNodeFromSvg(svg: string): FigmaFrameNode {
    const node = createSVGNodes(this.graph, this._currentPageId, svg, { keepEmpty: true })
    if (!node) throw new Error('in createNodeFromSvg: Failed to convert SVG file')
    return this.wrapNode(node.id) as FigmaFrameNode
  }

  /**
   * A connector as Figma's plugin API makes one: "Connector line", free from the page origin to
   * 200 px right of it, with no start cap and an arrow at the end.
   */
  createConnector(): FigmaConnectorNode {
    const node = createConnector(this.graph, this._currentPageId, {
      start: freeEndpoint(0, 0),
      end: freeEndpoint(200, 0),
      startCap: 'NONE',
      endCap: 'ARROW_LINES'
    })
    return this.wrapNode(node.id) as FigmaConnectorNode
  }

  createComponent(): FigmaComponentNode {
    return this._createNode('COMPONENT') as FigmaComponentNode
  }

  createSection(): FigmaSectionNode {
    return this._createNode('SECTION') as FigmaSectionNode
  }

  createPage(): FigmaNodeProxy {
    const page = this.graph.addPage('Page')
    setDefaultPageBackground(this.graph, page, this.theme)
    return this.wrapNode(page.id)
  }

  // --- Grouping ---

  private _nodeId(node: BaseNode | FigmaNodeProxy): string {
    return (node as BaseNode & { [INTERNAL_ID]: string })[INTERNAL_ID]
  }

  private _rawNode(node: BaseNode | FigmaNodeProxy): CoreSceneNode {
    const id = this._nodeId(node)
    const raw = this.graph.getNode(id)
    if (!raw) throw new Error(`Node ${id} not found`)
    return raw
  }

  group(
    nodes: ReadonlyArray<FigmaNodeProxy>,
    parent: FigmaNodeProxy,
    index?: number
  ): FigmaGroupNode
  group(nodes: ReadonlyArray<BaseNode>, parent: BaseNode & ChildrenMixin, index?: number): GroupNode
  group(
    nodes: ReadonlyArray<BaseNode | FigmaNodeProxy>,
    parent: (BaseNode & ChildrenMixin) | FigmaNodeProxy,
    index?: number
  ): FigmaGroupNode {
    const parentId = this._nodeId(parent)
    const members = nodes.map((node) => this._rawNode(node))
    const groupNode = wrapNodes(this.graph, 'GROUP', members, parentId, index)
    return this.wrapNode(groupNode.id) as FigmaGroupNode
  }

  ungroup(node: FigmaNodeProxy): FigmaNodeProxy[]
  ungroup(node: SceneNode & ChildrenMixin): Array<SceneNode>
  ungroup(node: (SceneNode & ChildrenMixin) | FigmaNodeProxy): Array<SceneNode> | FigmaNodeProxy[] {
    const children = ungroupNode(this.graph, this._nodeId(node)) ?? []
    return children.map((id) => this.wrapNode(id))
  }

  createComponentFromNode(node: FigmaNodeProxy): FigmaNodeProxy {
    const raw = this.graph.getNode(node[INTERNAL_ID])
    if (!raw) throw new Error('Node not found')
    return this.wrapNode(componentFromNode(this.graph, raw, raw.parentId ?? this._currentPageId).id)
  }

  combineAsVariants(
    nodes: ReadonlyArray<FigmaComponentNode>,
    parent: FigmaNodeProxy,
    index?: number
  ): FigmaComponentSetNode
  combineAsVariants(
    nodes: ReadonlyArray<ComponentNode>,
    parent: BaseNode & ChildrenMixin,
    index?: number
  ): ComponentSetNode
  combineAsVariants(
    nodes: ReadonlyArray<ComponentNode | FigmaComponentNode>,
    parent: (BaseNode & ChildrenMixin) | FigmaNodeProxy,
    index?: number
  ): FigmaComponentSetNode {
    const componentSet = combineComponentsAsVariants(
      this.graph,
      nodes.map((node) => this._nodeId(node)),
      this._nodeId(parent),
      index
    )
    return this.wrapNode(componentSet.id) as FigmaComponentSetNode
  }

  // --- Boolean Operations ---

  private _booleanOperation(
    operation: 'UNION' | 'SUBTRACT' | 'INTERSECT' | 'EXCLUDE',
    nodes: ReadonlyArray<BaseNode | FigmaNodeProxy>,
    parent: (BaseNode & ChildrenMixin) | FigmaNodeProxy,
    index?: number
  ): FigmaBooleanOperationNode {
    if (nodes.length < 2) throw new Error('Need at least 2 nodes for boolean operation')
    const parentId = this._nodeId(parent)
    const members = nodes.map((node) => this._rawNode(node))
    const { node: group } = createBooleanOperation(
      this.graph,
      members,
      parentId,
      operation,
      index,
      booleanOperationPaints(operation, members, 'script'),
      this.groupFitOptions
    )
    return this.wrapNode(group.id) as FigmaBooleanOperationNode
  }

  union(
    nodes: ReadonlyArray<FigmaNodeProxy>,
    parent: FigmaNodeProxy,
    index?: number
  ): FigmaBooleanOperationNode
  union(
    nodes: ReadonlyArray<BaseNode>,
    parent: BaseNode & ChildrenMixin,
    index?: number
  ): BooleanOperationNode
  union(
    nodes: ReadonlyArray<BaseNode | FigmaNodeProxy>,
    parent: (BaseNode & ChildrenMixin) | FigmaNodeProxy,
    index?: number
  ): FigmaBooleanOperationNode {
    return this._booleanOperation('UNION', nodes, parent, index)
  }

  subtract(
    nodes: ReadonlyArray<FigmaNodeProxy>,
    parent: FigmaNodeProxy,
    index?: number
  ): FigmaBooleanOperationNode
  subtract(
    nodes: ReadonlyArray<BaseNode>,
    parent: BaseNode & ChildrenMixin,
    index?: number
  ): BooleanOperationNode
  subtract(
    nodes: ReadonlyArray<BaseNode | FigmaNodeProxy>,
    parent: (BaseNode & ChildrenMixin) | FigmaNodeProxy,
    index?: number
  ): FigmaBooleanOperationNode {
    return this._booleanOperation('SUBTRACT', nodes, parent, index)
  }

  intersect(
    nodes: ReadonlyArray<FigmaNodeProxy>,
    parent: FigmaNodeProxy,
    index?: number
  ): FigmaBooleanOperationNode
  intersect(
    nodes: ReadonlyArray<BaseNode>,
    parent: BaseNode & ChildrenMixin,
    index?: number
  ): BooleanOperationNode
  intersect(
    nodes: ReadonlyArray<BaseNode | FigmaNodeProxy>,
    parent: (BaseNode & ChildrenMixin) | FigmaNodeProxy,
    index?: number
  ): FigmaBooleanOperationNode {
    return this._booleanOperation('INTERSECT', nodes, parent, index)
  }

  exclude(
    nodes: ReadonlyArray<FigmaNodeProxy>,
    parent: FigmaNodeProxy,
    index?: number
  ): FigmaBooleanOperationNode
  exclude(
    nodes: ReadonlyArray<BaseNode>,
    parent: BaseNode & ChildrenMixin,
    index?: number
  ): BooleanOperationNode
  exclude(
    nodes: ReadonlyArray<BaseNode | FigmaNodeProxy>,
    parent: (BaseNode & ChildrenMixin) | FigmaNodeProxy,
    index?: number
  ): FigmaBooleanOperationNode {
    return this._booleanOperation('EXCLUDE', nodes, parent, index)
  }

  // --- Flatten ---

  flatten(
    nodes: ReadonlyArray<FigmaNodeProxy>,
    parent?: FigmaNodeProxy,
    index?: number
  ): FigmaVectorNode
  flatten(
    nodes: ReadonlyArray<BaseNode>,
    parent?: BaseNode & ChildrenMixin,
    index?: number
  ): VectorNode
  flatten(
    nodes: ReadonlyArray<BaseNode | FigmaNodeProxy>,
    parent?: (BaseNode & ChildrenMixin) | FigmaNodeProxy,
    index?: number
  ): FigmaVectorNode {
    if (nodes.length === 0) throw new Error('Need at least 1 node to flatten')
    const parentId = this._nodeId(parent ?? this.currentPage)
    const sourceNodes: CoreSceneNode[] = []
    for (const node of nodes) {
      const raw = this.graph.getNode(this._nodeId(node))
      if (!raw) throw new Error('Node not found')
      sourceNodes.push(raw)
    }
    const vector = flattenSceneNodes(this.graph, this._renderer, sourceNodes, parentId)
    if (index != null) this.graph.insertChildAt(vector.id, parentId, index)
    for (const node of nodes) {
      this.graph.deleteNode(this._nodeId(node))
    }
    return this.wrapNode(vector.id) as FigmaVectorNode
  }

  // --- Viewport ---

  private _viewport = { x: 0, y: 0, zoom: 1 }

  get viewport(): {
    center: Vector
    zoom: number
    scrollAndZoomIntoView: (nodes: readonly { absoluteBoundingBox: Rect }[]) => void
  } {
    return {
      center: { x: this._viewport.x, y: this._viewport.y },
      zoom: this._viewport.zoom,
      scrollAndZoomIntoView: (nodes) => {
        const b = computeBounds(nodes.map((n) => n.absoluteBoundingBox))
        if (b.width === 0 && b.height === 0 && nodes.length === 0) return

        const padding = 80
        const contentW = b.width + padding * 2
        const contentH = b.height + padding * 2
        const viewW = IS_BROWSER ? window.innerWidth : 1280
        const viewH = IS_BROWSER ? window.innerHeight : 720
        const zoom = Math.min(viewW / contentW, viewH / contentH, 1)
        this._viewport = { x: b.x + b.width / 2, y: b.y + b.height / 2, zoom }
      }
    }
  }

  set viewport(v: { center: Vector; zoom: number }) {
    this._viewport = { x: v.center.x, y: v.center.y, zoom: v.zoom }
  }

  createImage(data: Uint8Array): Image {
    return images.createImage(this.graph, data)
  }

  getImageByHash(hash: string): Image | null {
    return images.imageByHash(this.graph, hash)
  }

  /** Fetches the image at `src` through the host's `fetch` and stores it as `createImage` does. */
  createImageAsync(src: string): Promise<Image> {
    return images.fetchImage(this.graph, src, this.#fetch)
  }

  // --- Stubs ---

  /** Loads the font so text measures and draws with it from then on; rejects as Figma does. */
  async loadFontAsync(fontName: FigmaFontNameInput): Promise<void> {
    await loadFigmaFont(fontName)
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

  async listAvailableFontsAsync(): Promise<FigmaFont[]> {
    // Default: pure browser / test contexts have no enumeration surface.
    // Desktop hosts override this to return system + bundled fonts.
    return []
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

  /** Every page is already in memory. */
  async loadAllPagesAsync(): Promise<void> {
    return undefined
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
