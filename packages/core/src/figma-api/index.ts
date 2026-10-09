import { fromUint8Array, isValid, toUint8Array } from 'js-base64'

import type {
  GroupFitOptions,
  SceneGraph,
  SceneNode as CoreSceneNode,
  NodeType,
  Variable,
  VariableCollection,
  VariableType,
  VariableValue
} from '@open-pencil/scene-graph'
import { copyFills } from '@open-pencil/scene-graph/copy'
import { computeBounds } from '@open-pencil/scene-graph/geometry'
import { computeImageHash } from '@open-pencil/scene-graph/images'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

import type { SkiaRenderer } from '#core/canvas'
import { canMakeBooleanSourceNode, groupFitOptions } from '#core/canvas/boolean'
import { flattenNodesToVectorProps } from '#core/canvas/flatten'
import { IS_BROWSER, type InterfaceTheme } from '#core/constants'
import { newLayerDefaults } from '#core/editor/shapes/defaults'
import { booleanOperationPaints, createBooleanOperation } from '#core/editor/structure/boolean'
import { wrapNodes } from '#core/editor/structure/container-wrap'
import { ungroupNode } from '#core/editor/structure/group'
import { textAutoResizeChanges } from '#core/editor/text/auto-resize'
import { setDefaultPageBackground } from '#core/figma-api/page-backgrounds'
import { iconify, type IconProvider } from '#core/icons'
import type { RasterCodec } from '#core/io/formats/raster'
import { reconcileVariableLayouts } from '#core/layout/variables'
import { documentFontStatus, type DocumentFontStatus } from '#core/text/font/status'

import { combineComponentsAsVariants, componentFromNode, exposeInstanceSwap } from './components'
import type {
  FigmaBooleanOperationNode,
  FigmaComponentNode,
  FigmaComponentSetNode,
  FigmaEllipseNode,
  FigmaFrameNode,
  FigmaGroupNode,
  FigmaLineNode,
  FigmaPolygonNode,
  FigmaRectangleNode,
  FigmaSectionNode,
  FigmaStarNode,
  FigmaTextNode,
  FigmaVectorNode
} from './node-types'
import { startPendingLayout } from './pending-layout'
import {
  FigmaNodeProxy,
  INTERNAL_ID,
  MIXED,
  type FigmaFont,
  type FigmaFontName,
  type NodeProxyHost
} from './proxy'
import type { ExportImageOptions } from './types'

const noop = () => undefined

export { FigmaNodeProxy } from './proxy'
export type { FigmaEffect } from './effects'
export type { ExportImageOptions } from './types'
export type {
  FigmaBooleanOperationNode,
  FigmaComponentNode,
  FigmaComponentSetNode,
  FigmaEllipseNode,
  FigmaFrameNode,
  FigmaGroupNode,
  FigmaInstanceNode,
  FigmaLineNode,
  FigmaPolygonNode,
  FigmaRectangleNode,
  FigmaSectionNode,
  FigmaSlotNode,
  FigmaStarNode,
  FigmaTextNode,
  FigmaVectorNode
} from './node-types'
export type { FigmaFont, FigmaFontName } from './proxy'

export { computeImageHash }

// TODO(figma-api): Implement the full official PluginAPI interface once our compatibility
// layer covers all required node-specific return types and unsupported APIs are modeled explicitly.
export class FigmaAPI implements NodeProxyHost {
  readonly graph: SceneGraph
  private _currentPageId: string
  private _selection: FigmaNodeProxy[] = []
  private _nodeCache = new Map<string, FigmaNodeProxy>()
  private _pageProxies = new WeakSet<FigmaNodeProxy>()
  private _renderer: SkiaRenderer | null = null
  /** The interface theme new sections take their fill from, as in Figma. */
  theme: InterfaceTheme = 'light'

  readonly mixed = MIXED

  constructor(graph: SceneGraph) {
    this.graph = graph
    startPendingLayout(graph)
    const pages = graph.getPages()
    this._currentPageId = pages[0]?.id ?? graph.rootId
  }

  setRenderer(renderer: SkiaRenderer | null): void {
    this._renderer = renderer
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

  // --- Node Creation ---

  /** New layers start as the editor's tools make them, which is how Figma's plugin API makes them. */
  private _createNode(type: NodeType): FigmaNodeProxy {
    const defaults = newLayerDefaults(type, this.theme)
    // Figma's plugin API makes a line 100 wide with no height, and a section 496 square.
    if (type === 'LINE') defaults.height = 0
    if (type === 'SECTION') Object.assign(defaults, { width: 496, height: 496 })
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

  createVector(): FigmaVectorNode {
    return this._createNode('VECTOR') as FigmaVectorNode
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

  exposeInstanceSwap(
    slots: ReadonlyArray<FigmaNodeProxy>,
    candidates: ReadonlyArray<FigmaNodeProxy>,
    propertyName = 'Instance'
  ): FigmaNodeProxy {
    const host = exposeInstanceSwap(this.graph, slots, candidates, propertyName)
    return this.wrapNode(host.id)
  }

  getVariableById(id: string): Variable | null {
    return this.graph.variables.get(id) ?? null
  }

  getLocalVariables(type?: string): Variable[] {
    const vars = [...this.graph.variables.values()]
    if (type) return vars.filter((v) => v.type === type)
    return vars
  }

  getLocalVariableCollections(): VariableCollection[] {
    return [...this.graph.variableCollections.values()]
  }

  getVariableCollectionById(id: string): VariableCollection | null {
    return this.graph.variableCollections.get(id) ?? null
  }

  // --- Variable/Collection CRUD ---

  createVariable(
    name: string,
    type: VariableType,
    collectionId: string,
    value?: VariableValue
  ): Variable {
    return this.graph.createVariable(name, type, collectionId, value)
  }

  setVariableValue(variableId: string, modeId: string, value: VariableValue): void {
    const variable = this.graph.variables.get(variableId)
    if (!variable) throw new Error(`Variable "${variableId}" not found`)
    variable.valuesByMode[modeId] = structuredClone(value)
    reconcileVariableLayouts(this.graph, { variables: [variableId] })
  }

  deleteVariable(id: string): void {
    this.graph.removeVariable(id)
  }

  createVariableCollection(name: string): VariableCollection {
    return this.graph.createCollection(name)
  }

  deleteVariableCollection(id: string): void {
    this.graph.removeCollection(id)
  }

  bindVariable(nodeId: string, field: string, variableId: string): void {
    this.graph.bindVariable(nodeId, field, variableId)
    reconcileVariableLayouts(this.graph, { subtrees: [nodeId] })
  }

  unbindVariable(nodeId: string, field: string): void {
    this.graph.unbindVariable(nodeId, field)
    reconcileVariableLayouts(this.graph, { subtrees: [nodeId] })
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

  private _nodesById(nodeIds: string[]) {
    return nodeIds.map((id) => {
      const node = this.getNodeById(id)
      if (!node) throw new Error(`Node ${id} not found`)
      return node
    })
  }

  booleanOperation(
    operation: 'UNION' | 'SUBTRACT' | 'INTERSECT' | 'EXCLUDE',
    nodeIds: string[]
  ): FigmaBooleanOperationNode {
    const first = this.graph.getNode(nodeIds[0])
    const parent = this.wrapNode(first?.parentId ?? this._currentPageId)
    return this._booleanOperation(operation, this._nodesById(nodeIds), parent)
  }

  union(
    nodes: ReadonlyArray<BaseNode>,
    parent: BaseNode & ChildrenMixin,
    index?: number
  ): BooleanOperationNode {
    return this._booleanOperation('UNION', nodes, parent, index)
  }

  subtract(
    nodes: ReadonlyArray<BaseNode>,
    parent: BaseNode & ChildrenMixin,
    index?: number
  ): BooleanOperationNode {
    return this._booleanOperation('SUBTRACT', nodes, parent, index)
  }

  intersect(
    nodes: ReadonlyArray<BaseNode>,
    parent: BaseNode & ChildrenMixin,
    index?: number
  ): BooleanOperationNode {
    return this._booleanOperation('INTERSECT', nodes, parent, index)
  }

  exclude(
    nodes: ReadonlyArray<BaseNode>,
    parent: BaseNode & ChildrenMixin,
    index?: number
  ): BooleanOperationNode {
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
    const vector = this._renderer
      ? this._flattenWithRenderer(sourceNodes, parentId)
      : this._flattenPlaceholder(sourceNodes, parentId)
    if (index != null) this.graph.reorderChild(vector.id, parentId, index)
    for (const node of nodes) {
      this.graph.deleteNode(this._nodeId(node))
    }
    return this.wrapNode(vector.id) as FigmaVectorNode
  }

  private _flattenPlaceholder(nodes: CoreSceneNode[], parentId: string): CoreSceneNode {
    const first = nodes[0]
    return this.graph.createNode('VECTOR', parentId, {
      name: 'Flatten',
      x: first.x,
      y: first.y,
      width: first.width,
      height: first.height,
      fills: copyFills(first.fills)
    })
  }

  private _flattenWithRenderer(nodes: CoreSceneNode[], parentId: string): CoreSceneNode {
    const renderer = this._renderer
    if (!renderer) return this._flattenPlaceholder(nodes, parentId)
    if (nodes.some((node) => !canMakeBooleanSourceNode(node, this.graph))) {
      throw new Error('Cannot flatten unsupported node type')
    }

    const vectorProps = flattenNodesToVectorProps(renderer, this.graph, nodes)
    if (!vectorProps) throw new Error('Cannot flatten empty node path')
    return this.graph.createNode('VECTOR', parentId, vectorProps)
  }

  flattenNode(nodeIds: string[]): FigmaVectorNode {
    const first = this.graph.getNode(nodeIds[0])
    const parent = this.wrapNode(first?.parentId ?? this._currentPageId)
    return this.flatten(this._nodesById(nodeIds), parent)
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

  createImage(data: Uint8Array): { hash: string } {
    const hash = computeImageHash(data)
    this.graph.images.set(hash, data)
    return { hash }
  }

  // --- Stubs ---

  async loadFontAsync(_fontName: FigmaFontName): Promise<void> {
    // No-op: we don't gate text editing on font loading
  }

  async listAvailableFontsAsync(): Promise<FigmaFont[]> {
    // Default: pure browser / test contexts have no enumeration surface.
    // Desktop hosts override this to return system + bundled fonts.
    return []
  }

  getFontStatus(): DocumentFontStatus {
    return documentFontStatus(this.graph, this.currentPageId)
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

  commitUndo(): void {
    return undefined
  }

  triggerUndo(): void {
    return undefined
  }

  exportImage?: (nodeIds: string[], options: ExportImageOptions) => Promise<Uint8Array | null>
  /** Where icon tools search and fetch icons; hosts may pass a self-hosted or bundled set. */
  icons: IconProvider = iconify
  rasterCodec?: RasterCodec
  /** The document as it was before the current AI run first edited `pageId`, or null if unedited. */
  changeBaseline?: (pageId: string) => SceneGraph | null
}
