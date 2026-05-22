import type { SkiaRenderer } from '#core/canvas'
import { canMakeBooleanSourceNode } from '#core/canvas/boolean'
import { flattenNodesToVectorProps } from '#core/canvas/flatten'
import { IS_BROWSER } from '#core/constants'
import { computeBounds } from '#core/geometry'
import type { RasterExportFormat } from '#core/io/formats/raster'
import type {
  SceneGraph,
  SceneNode as CoreSceneNode,
  NodeType,
  Variable,
  VariableCollection,
  VariableType,
  VariableValue
} from '#core/scene-graph'
import { copyFills, copyStrokes, copyEffects } from '#core/scene-graph/copy'
import type { Rect, Vector } from '#core/types'

import type {
  FigmaBooleanOperationNode,
  FigmaComponentNode,
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
import {
  FigmaNodeProxy,
  INTERNAL_ID,
  MIXED,
  type FigmaFont,
  type FigmaFontName,
  type NodeProxyHost
} from './proxy'

const noop = () => undefined

export { FigmaNodeProxy } from './proxy'
export type {
  FigmaBooleanOperationNode,
  FigmaComponentNode,
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
export type { FigmaFont, FigmaFontName } from './proxy'

export function computeImageHash(data: Uint8Array): string {
  let h1 = 0x811c9dc5 >>> 0
  let h2 = 0x811c9dc5 >>> 0
  let h3 = 0x811c9dc5 >>> 0
  let h4 = 0x811c9dc5 >>> 0
  let h5 = 0x811c9dc5 >>> 0
  for (let i = 0; i < data.length; i++) {
    const b = data[i]
    switch (i % 5) {
      case 0:
        h1 ^= b
        h1 = Math.imul(h1, 0x01000193) >>> 0
        break
      case 1:
        h2 ^= b
        h2 = Math.imul(h2, 0x01000193) >>> 0
        break
      case 2:
        h3 ^= b
        h3 = Math.imul(h3, 0x01000193) >>> 0
        break
      case 3:
        h4 ^= b
        h4 = Math.imul(h4, 0x01000193) >>> 0
        break
      case 4:
        h5 ^= b
        h5 = Math.imul(h5, 0x01000193) >>> 0
        break
    }
  }
  return [h1, h2, h3, h4, h5].map((h) => h.toString(16).padStart(8, '0')).join('')
}

// TODO(figma-api): Implement the full official PluginAPI interface once our compatibility
// layer covers all required node-specific return types and unsupported APIs are modeled explicitly.
export class FigmaAPI implements NodeProxyHost {
  readonly graph: SceneGraph
  private _currentPageId: string
  private _selection: FigmaNodeProxy[] = []
  private _nodeCache = new Map<string, FigmaNodeProxy>()
  private _pageProxies = new WeakSet<FigmaNodeProxy>()
  private _renderer: SkiaRenderer | null = null

  readonly mixed = MIXED

  constructor(graph: SceneGraph) {
    this.graph = graph
    const pages = graph.getPages()
    this._currentPageId = pages[0]?.id ?? graph.rootId
  }

  setRenderer(renderer: SkiaRenderer | null): void {
    this._renderer = renderer
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

  // --- Node Creation ---

  private _createNode(type: NodeType): FigmaNodeProxy {
    const node = this.graph.createNode(type, this._currentPageId)
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
    return this._createNode('TEXT') as FigmaTextNode
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
    return this.wrapNode(page.id)
  }

  // --- Grouping ---

  private _nodeId(node: BaseNode | FigmaNodeProxy): string {
    return (node as BaseNode & { [INTERNAL_ID]: string })[INTERNAL_ID]
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
    const groupNode = this.graph.createNode('GROUP', parentId)
    for (const n of nodes) {
      this.graph.reparentNode(this._nodeId(n), groupNode.id)
    }
    if (index != null) this.graph.reorderChild(groupNode.id, parentId, index)
    return this.wrapNode(groupNode.id) as FigmaGroupNode
  }

  ungroup(node: FigmaNodeProxy): FigmaNodeProxy[]
  ungroup(node: SceneNode & ChildrenMixin): Array<SceneNode>
  ungroup(node: (SceneNode & ChildrenMixin) | FigmaNodeProxy): Array<SceneNode> | FigmaNodeProxy[] {
    const nodeId = this._nodeId(node)
    const raw = this.graph.getNode(nodeId)
    if (!raw || raw.childIds.length === 0) return []
    const parentId = raw.parentId ?? this._currentPageId
    const children = Array.from(raw.childIds)
    for (const childId of children) {
      this.graph.reparentNode(childId, parentId)
    }
    this.graph.deleteNode(nodeId)
    return children.map((id) => this.wrapNode(id))
  }

  createComponentFromNode(node: FigmaNodeProxy): FigmaNodeProxy {
    const raw = this.graph.getNode(node[INTERNAL_ID])
    if (!raw) throw new Error('Node not found')
    const parentId = raw.parentId ?? this._currentPageId
    const comp = this.graph.createNode('COMPONENT', parentId)
    this.graph.updateNode(comp.id, {
      name: raw.name,
      width: raw.width,
      height: raw.height,
      x: raw.x,
      y: raw.y,
      fills: copyFills(raw.fills),
      strokes: copyStrokes(raw.strokes),
      effects: copyEffects(raw.effects),
      cornerRadius: raw.cornerRadius,
      topLeftRadius: raw.topLeftRadius,
      topRightRadius: raw.topRightRadius,
      bottomRightRadius: raw.bottomRightRadius,
      bottomLeftRadius: raw.bottomLeftRadius,
      independentCorners: raw.independentCorners,
      opacity: raw.opacity,
      layoutMode: raw.layoutMode,
      primaryAxisAlign: raw.primaryAxisAlign,
      counterAxisAlign: raw.counterAxisAlign,
      itemSpacing: raw.itemSpacing,
      paddingTop: raw.paddingTop,
      paddingRight: raw.paddingRight,
      paddingBottom: raw.paddingBottom,
      paddingLeft: raw.paddingLeft,
      pluginData: structuredClone(raw.pluginData),
      pluginRelaunchData: structuredClone(raw.pluginRelaunchData)
    })
    for (const childId of raw.childIds) {
      this.graph.cloneTree(childId, comp.id)
    }
    this.graph.deleteNode(node[INTERNAL_ID])
    return this.wrapNode(comp.id)
  }

  // --- Variables ---

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
    variable.valuesByMode[modeId] = value
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
  }

  unbindVariable(nodeId: string, field: string): void {
    this.graph.unbindVariable(nodeId, field)
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
    const first = this.graph.getNode(this._nodeId(nodes[0]))
    if (!first) throw new Error('Node not found')
    const group = this.graph.createNode('BOOLEAN_OPERATION', parentId, {
      name: `Boolean ${operation.toLowerCase()}`,
      x: first.x,
      y: first.y,
      width: first.width,
      height: first.height,
      booleanOperation: operation
    })
    for (const node of nodes) {
      this.graph.reparentNode(this._nodeId(node), group.id)
    }
    if (index != null) this.graph.reorderChild(group.id, parentId, index)
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

  base64Encode(data: Uint8Array): string {
    return data.toBase64()
  }

  base64Decode(data: string): Uint8Array {
    return Uint8Array.fromBase64(data)
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

  exportImage?: (
    nodeIds: string[],
    options: { scale?: number; format?: RasterExportFormat; quality?: number }
  ) => Promise<Uint8Array | null>
}
