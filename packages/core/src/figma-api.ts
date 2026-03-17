import type {
  SceneGraph,
  NodeType,
  Variable,
  VariableCollection,
  VariableType,
  VariableValue
} from './scene-graph'
import type { Rect, Vector } from './types'
import { IS_BROWSER } from './constants'
import { computeBounds } from './geometry'
import { copyFills, copyStrokes, copyEffects } from './copy'

import {
  FigmaNodeProxy,
  INTERNAL_ID,
  MIXED,
  type FigmaFontName,
  type NodeProxyHost,
} from './figma-api-proxy'

export { FigmaNodeProxy } from './figma-api-proxy'
export type { FigmaFontName } from './figma-api-proxy'

export function computeImageHash(data: Uint8Array): string {
  let h1 = 0x811c9dc5 >>> 0
  let h2 = 0x811c9dc5 >>> 0
  let h3 = 0x811c9dc5 >>> 0
  let h4 = 0x811c9dc5 >>> 0
  let h5 = 0x811c9dc5 >>> 0
  for (let i = 0; i < data.length; i++) {
    const b = data[i]
    switch (i % 5) {
      case 0: h1 ^= b; h1 = Math.imul(h1, 0x01000193) >>> 0; break
      case 1: h2 ^= b; h2 = Math.imul(h2, 0x01000193) >>> 0; break
      case 2: h3 ^= b; h3 = Math.imul(h3, 0x01000193) >>> 0; break
      case 3: h4 ^= b; h4 = Math.imul(h4, 0x01000193) >>> 0; break
      case 4: h5 ^= b; h5 = Math.imul(h5, 0x01000193) >>> 0; break
    }
  }
  return [h1, h2, h3, h4, h5].map(h => h.toString(16).padStart(8, '0')).join('')
}

export class FigmaAPI implements NodeProxyHost {
  readonly graph: SceneGraph
  private _currentPageId: string
  private _selection: FigmaNodeProxy[] = []
  private _nodeCache = new Map<string, FigmaNodeProxy>()
  private _pageProxies = new WeakSet<FigmaNodeProxy>()

  readonly mixed = MIXED

  constructor(graph: SceneGraph) {
    this.graph = graph
    const pages = graph.getPages()
    this._currentPageId = pages[0]?.id ?? graph.rootId
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

  createFrame(): FigmaNodeProxy {
    return this._createNode('FRAME')
  }

  createRectangle(): FigmaNodeProxy {
    return this._createNode('RECTANGLE')
  }

  createEllipse(): FigmaNodeProxy {
    return this._createNode('ELLIPSE')
  }

  createText(): FigmaNodeProxy {
    return this._createNode('TEXT')
  }

  createLine(): FigmaNodeProxy {
    return this._createNode('LINE')
  }

  createPolygon(): FigmaNodeProxy {
    return this._createNode('POLYGON')
  }

  createStar(): FigmaNodeProxy {
    return this._createNode('STAR')
  }

  createVector(): FigmaNodeProxy {
    return this._createNode('VECTOR')
  }

  createComponent(): FigmaNodeProxy {
    return this._createNode('COMPONENT')
  }

  createSection(): FigmaNodeProxy {
    return this._createNode('SECTION')
  }

  createPage(): FigmaNodeProxy {
    const page = this.graph.addPage('Page')
    return this.wrapNode(page.id)
  }

  // --- Grouping ---

  group(nodes: FigmaNodeProxy[], parent: FigmaNodeProxy): FigmaNodeProxy {
    const groupNode = this.graph.createNode('GROUP', parent[INTERNAL_ID])
    for (const n of nodes) {
      this.graph.reparentNode(n[INTERNAL_ID], groupNode.id)
    }
    return this.wrapNode(groupNode.id)
  }

  ungroup(node: FigmaNodeProxy): void {
    const raw = this.graph.getNode(node[INTERNAL_ID])
    if (raw?.type !== 'GROUP') return
    const parentId = raw.parentId ?? this._currentPageId
    for (const childId of Array.from(raw.childIds)) {
      this.graph.reparentNode(childId, parentId)
    }
    this.graph.deleteNode(node[INTERNAL_ID])
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
      paddingLeft: raw.paddingLeft
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

  booleanOperation(
    operation: 'UNION' | 'SUBTRACT' | 'INTERSECT' | 'EXCLUDE',
    nodeIds: string[]
  ): FigmaNodeProxy {
    if (nodeIds.length < 2) throw new Error('Need at least 2 nodes for boolean operation')
    const nodes = nodeIds.map((id) => this.graph.getNode(id))
    const first = nodes[0]
    if (!first || nodes.some((n) => !n)) throw new Error('One or more nodes not found')
    const parentId = first.parentId ?? this._currentPageId
    const group = this.graph.createNode('GROUP', parentId, {
      name: `Boolean ${operation.toLowerCase()}`,
      x: first.x,
      y: first.y,
      width: first.width,
      height: first.height
    })
    for (const id of nodeIds) {
      this.graph.reparentNode(id, group.id)
    }
    return this.wrapNode(group.id)
  }

  // --- Flatten ---

  flattenNode(nodeIds: string[]): FigmaNodeProxy {
    if (nodeIds.length === 0) throw new Error('Need at least 1 node to flatten')
    const first = this.graph.getNode(nodeIds[0])
    if (!first) throw new Error('Node not found')
    const parentId = first.parentId ?? this._currentPageId
    const vector = this.graph.createNode('VECTOR', parentId, {
      name: 'Flatten',
      x: first.x,
      y: first.y,
      width: first.width,
      height: first.height,
      fills: copyFills(first.fills)
    })
    for (const id of nodeIds) {
      this.graph.deleteNode(id)
    }
    return this.wrapNode(vector.id)
  }

  // --- Viewport ---

  private _viewport = { x: 0, y: 0, zoom: 1 }

  get viewport(): { center: Vector; zoom: number; scrollAndZoomIntoView: (nodes: readonly { absoluteBoundingBox: Rect }[]) => void } {
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

  notify(message: string): { cancel: () => void } {
    if (typeof console !== 'undefined') console.log(`[figma.notify] ${message}`)
    // eslint-disable-next-line no-empty-function
    return { cancel() {} }
  }

  // eslint-disable-next-line no-empty-function
  commitUndo(): void {}
  // eslint-disable-next-line no-empty-function
  triggerUndo(): void {}

  exportImage?: (
    nodeIds: string[],
    options: { scale?: number; format?: 'PNG' | 'JPG' | 'WEBP'; quality?: number }
  ) => Promise<Uint8Array | null>
}
