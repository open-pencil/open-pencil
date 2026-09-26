import { recordInstanceOverride } from '@open-pencil/scene-graph'
import type {
  SceneGraph,
  SceneNode,
  NodeType,
  Fill,
  Stroke,
  Effect,
  LayoutMode
} from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import {
  getFillOkHCL,
  getStrokeOkHCL,
  setNodeFillOkHCL,
  setNodeStrokeOkHCL
} from '#core/color/okhcl'
import type { OkHCLColor, OkHCLPayload } from '#core/color/okhcl'
import { assertNodeEditable } from '#core/editor/capabilities'

import { installBasicNodeProxyAccessors } from './accessors/basic'
import { installLayoutNodeProxyAccessors } from './accessors/layout'
import { installStrokeNodeProxyAccessors } from './accessors/strokes'
import { installTextNodeProxyAccessors } from './accessors/text'
import { installVariableModeNodeProxyAccessors } from './accessors/variables'
import {
  installVectorNodeProxyAccessors,
  type FigmaVectorNetwork,
  type FigmaVectorPath
} from './accessors/vector'
import { installVisualNodeProxyAccessors } from './accessors/visual'
import { installComponentPropertyAccessors } from './components'
import type { FigmaFontName } from './fonts'
import { getPageBackgrounds, setPageBackgrounds } from './page-backgrounds'
import * as PluginData from './plugin-data'
import { nodeProxyToJSON } from './serialization'
import * as TextProxy from './text'
import * as Traversal from './traversal'
import type { FigmaTransform } from './types'

const MIXED = Symbol('mixed')

export { styleNameToWeight, weightToStyleName, type FigmaFont, type FigmaFontName } from './fonts'

export const INTERNAL_ID = Symbol('id')
export const INTERNAL_GRAPH = Symbol('graph')
export const INTERNAL_API = Symbol('api')

export interface NodeProxyHost {
  wrapNode(id: string): FigmaNodeProxy
  readonly currentPageId: string
}

export { MIXED }

export class FigmaNodeProxy {
  [INTERNAL_ID]: string;
  [INTERNAL_GRAPH]: SceneGraph;
  [INTERNAL_API]: NodeProxyHost

  declare readonly id: string
  declare readonly type: NodeType
  declare name: string
  declare readonly removed: boolean
  declare x: number
  declare y: number
  declare readonly width: number
  declare readonly height: number
  declare rotation: number
  declare readonly relativeTransform: FigmaTransform
  declare resize: (width: number, height: number) => void
  declare resizeWithoutConstraints: (width: number, height: number) => void
  declare rescale: (scale: number) => void
  declare readonly absoluteTransform: FigmaTransform
  declare readonly absoluteBoundingBox: Rect
  declare readonly absoluteRenderBounds: Rect | null

  declare fills: readonly Fill[]
  declare strokes: readonly Stroke[]
  declare effects: readonly Effect[]
  declare opacity: number
  declare visible: boolean
  declare locked: boolean
  declare blendMode: string
  declare clipsContent: boolean
  declare cornerRadius: number | typeof MIXED
  declare topLeftRadius: number
  declare topRightRadius: number
  declare bottomLeftRadius: number
  declare bottomRightRadius: number
  declare cornerSmoothing: number

  declare layoutMode: LayoutMode
  declare layoutDirection: string
  declare primaryAxisAlignItems: string
  declare counterAxisAlignItems: string
  declare itemSpacing: number
  declare counterAxisSpacing: number
  declare paddingTop: number
  declare paddingRight: number
  declare paddingBottom: number
  declare paddingLeft: number
  declare layoutWrap: string
  declare primaryAxisSizingMode: string
  declare counterAxisSizingMode: string
  declare counterAxisAlignContent: string
  declare itemReverseZIndex: boolean
  declare strokesIncludedInLayout: boolean
  declare layoutPositioning: string
  declare layoutGrow: number
  declare layoutAlign: string
  declare layoutSizingHorizontal: string
  declare layoutSizingVertical: string
  declare constraints: { horizontal: string; vertical: string }
  declare minWidth: number | null
  declare maxWidth: number | null
  declare minHeight: number | null
  declare maxHeight: number | null
  declare vectorPaths: readonly FigmaVectorPath[]
  declare vectorNetwork: FigmaVectorNetwork
  declare setVectorNetworkAsync: (vectorNetwork: FigmaVectorNetwork) => Promise<void>
  declare handleMirroring: SceneNode['handleMirroring'] | typeof MIXED
  declare readonly explicitVariableModes: Readonly<Record<string, string>>
  declare readonly resolvedVariableModes: Readonly<Record<string, string>>

  declare strokeWeight: number
  declare strokeAlign: string
  declare dashPattern: readonly number[]
  declare strokeCap: string
  declare strokeJoin: string
  declare strokeMiterLimit: number
  declare strokeTopWeight: number
  declare strokeBottomWeight: number
  declare strokeLeftWeight: number
  declare strokeRightWeight: number

  declare characters: string
  declare fontSize: number
  declare fontName: FigmaFontName
  declare fontWeight: number
  declare textAlignHorizontal: string
  declare textAlignVertical: string
  declare textDirection: string
  declare textAutoResize: string
  declare letterSpacing: number
  declare lineHeight: number | null
  declare textCase: string
  declare textDecoration: string
  declare maxLines: number | null
  declare textTruncation: string
  declare autoRename: boolean

  constructor(id: string, graph: SceneGraph, api: NodeProxyHost) {
    this[INTERNAL_ID] = id
    this[INTERNAL_GRAPH] = graph
    this[INTERNAL_API] = api
    if (graph.getNode(id)?.type === 'VECTOR') {
      installVectorNodeProxyAccessors(
        this,
        { id: INTERNAL_ID, graph: INTERNAL_GRAPH, api: INTERNAL_API },
        MIXED
      )
    }
  }

  private _update(changes: Partial<SceneNode>): void {
    assertNodeEditable(this[INTERNAL_GRAPH], this[INTERNAL_ID])
    const graph = this[INTERNAL_GRAPH]
    const id = this[INTERNAL_ID]
    graph.updateNode(id, changes)
    recordInstanceOverride(graph, id, Object.keys(changes))
  }

  private _raw(): SceneNode {
    const n = this[INTERNAL_GRAPH].getNode(this[INTERNAL_ID])
    if (!n) throw new Error(`Node ${this[INTERNAL_ID]} has been removed`)
    return n
  }

  insertCharacters(start: number, characters: string): void {
    TextProxy.insertCharacters(this[INTERNAL_GRAPH], this._raw(), start, characters)
  }

  deleteCharacters(start: number, end: number): void {
    TextProxy.deleteCharacters(this[INTERNAL_GRAPH], this._raw(), start, end)
  }

  get isMask(): boolean {
    return this._raw().isMask
  }

  set isMask(v: boolean) {
    this._update({ isMask: v })
  }

  get maskType(): string {
    return this._raw().maskType
  }

  set maskType(v: string) {
    this._update({ maskType: v as SceneNode['maskType'] })
  }

  // --- UI state ---

  get expanded(): boolean {
    return this._raw().expanded
  }

  set expanded(v: boolean) {
    this._update({ expanded: v })
  }

  // --- Components ---

  get backgrounds(): readonly Fill[] {
    return getPageBackgrounds(this._raw())
  }

  set backgrounds(value: readonly Fill[]) {
    setPageBackgrounds(this[INTERNAL_GRAPH], this._raw(), value)
  }

  /** Points this instance at another component, as Figma's swapComponent does. */
  swapComponent(component: FigmaNodeProxy): void {
    const n = this._raw()
    if (n.type !== 'INSTANCE') throw new Error('swapComponent() can only be called on instances')
    const target = this[INTERNAL_GRAPH].getNode(component[INTERNAL_ID])
    if (target?.type !== 'COMPONENT') throw new Error('swapComponent() needs a component')
    assertNodeEditable(this[INTERNAL_GRAPH], this[INTERNAL_ID])
    this[INTERNAL_GRAPH].swapInstanceComponent(n.id, target.id)
  }

  get mainComponent(): FigmaNodeProxy | null {
    const n = this._raw()
    if (!n.componentId) return null
    const comp = this[INTERNAL_GRAPH].getNode(n.componentId)
    if (!comp) return null
    return this[INTERNAL_API].wrapNode(comp.id)
  }

  createInstance(): FigmaNodeProxy {
    const n = this._raw()
    if (n.type !== 'COMPONENT') throw new Error('createInstance() can only be called on components')
    const pageId = this[INTERNAL_API].currentPageId
    const inst = this[INTERNAL_GRAPH].createInstance(n.id, pageId)
    if (!inst) throw new Error('Failed to create instance')
    return this[INTERNAL_API].wrapNode(inst.id)
  }

  // --- Tree ---

  get parent(): FigmaNodeProxy | null {
    const n = this._raw()
    if (!n.parentId) return null
    return this[INTERNAL_API].wrapNode(n.parentId)
  }

  get children(): FigmaNodeProxy[] {
    return this[INTERNAL_GRAPH]
      .getChildren(this[INTERNAL_ID])
      .map((c) => this[INTERNAL_API].wrapNode(c.id))
  }

  appendChild(child: FigmaNodeProxy): void {
    assertNodeEditable(this[INTERNAL_GRAPH], this[INTERNAL_ID])
    assertNodeEditable(this[INTERNAL_GRAPH], child[INTERNAL_ID])
    this[INTERNAL_GRAPH].reparentNode(child[INTERNAL_ID], this[INTERNAL_ID])
  }

  insertChild(index: number, child: FigmaNodeProxy): void {
    assertNodeEditable(this[INTERNAL_GRAPH], this[INTERNAL_ID])
    assertNodeEditable(this[INTERNAL_GRAPH], child[INTERNAL_ID])
    this[INTERNAL_GRAPH].reparentNode(child[INTERNAL_ID], this[INTERNAL_ID])
    this[INTERNAL_GRAPH].reorderChild(child[INTERNAL_ID], this[INTERNAL_ID], index)
  }

  clone(): FigmaNodeProxy {
    assertNodeEditable(this[INTERNAL_GRAPH], this[INTERNAL_ID])
    const n = this._raw()
    const parentId = n.parentId ?? this[INTERNAL_API].currentPageId
    const cloned = this[INTERNAL_GRAPH].cloneTree(this[INTERNAL_ID], parentId)
    if (!cloned) throw new Error(`Failed to clone node ${this[INTERNAL_ID]}`)
    return this[INTERNAL_API].wrapNode(cloned.id)
  }

  remove(): void {
    assertNodeEditable(this[INTERNAL_GRAPH], this[INTERNAL_ID])
    this[INTERNAL_GRAPH].deleteNode(this[INTERNAL_ID])
  }

  findAll(callback?: (node: FigmaNodeProxy) => boolean): FigmaNodeProxy[] {
    return Traversal.findAll(this[INTERNAL_GRAPH], this[INTERNAL_API], this[INTERNAL_ID], callback)
  }

  findOne(callback: (node: FigmaNodeProxy) => boolean): FigmaNodeProxy | null {
    return Traversal.findOne(this[INTERNAL_GRAPH], this[INTERNAL_API], this[INTERNAL_ID], callback)
  }

  findChild(callback: (node: FigmaNodeProxy) => boolean): FigmaNodeProxy | null {
    return Traversal.findChild(
      this[INTERNAL_GRAPH],
      this[INTERNAL_API],
      this[INTERNAL_ID],
      callback
    )
  }

  findChildren(callback?: (node: FigmaNodeProxy) => boolean): FigmaNodeProxy[] {
    return Traversal.findChildren(
      this[INTERNAL_GRAPH],
      this[INTERNAL_API],
      this[INTERNAL_ID],
      callback
    )
  }

  findAllWithCriteria(criteria: { types?: string[] }): FigmaNodeProxy[] {
    return Traversal.findAllWithCriteria(
      this[INTERNAL_GRAPH],
      this[INTERNAL_API],
      this[INTERNAL_ID],
      criteria
    )
  }

  // --- Plugin data ---

  getPluginData(key: string): string {
    return PluginData.getPluginData(this._raw(), key)
  }

  setPluginData(key: string, value: string): void {
    assertNodeEditable(this[INTERNAL_GRAPH], this[INTERNAL_ID])
    PluginData.setPluginData(this[INTERNAL_GRAPH], this._raw(), key, value)
  }

  getPluginDataKeys(): string[] {
    return PluginData.getPluginDataKeys(this._raw())
  }

  getSharedPluginData(namespace: string, key: string): string {
    return PluginData.getSharedPluginData(this._raw(), namespace, key)
  }

  setSharedPluginData(namespace: string, key: string, value: string): void {
    assertNodeEditable(this[INTERNAL_GRAPH], this[INTERNAL_ID])
    PluginData.setSharedPluginData(this[INTERNAL_GRAPH], this._raw(), namespace, key, value)
  }

  getSharedPluginDataKeys(namespace: string): string[] {
    return PluginData.getSharedPluginDataKeys(this._raw(), namespace)
  }

  getFillOkHCL(index = 0): OkHCLPayload | null {
    return getFillOkHCL(this._raw(), index)
  }

  setFillOkHCL(color: OkHCLColor, index = 0): void {
    this._update(
      setNodeFillOkHCL(this._raw(), index, color, this[INTERNAL_GRAPH].documentColorSpace)
    )
  }

  getStrokeOkHCL(index = 0): OkHCLPayload | null {
    return getStrokeOkHCL(this._raw(), index)
  }

  setStrokeOkHCL(color: OkHCLColor, index = 0): void {
    this._update(
      setNodeStrokeOkHCL(this._raw(), index, color, this[INTERNAL_GRAPH].documentColorSpace)
    )
  }

  // --- Serialization ---

  toJSON(maxDepth?: number, currentDepth = 0): Record<string, unknown> {
    return nodeProxyToJSON(
      this[INTERNAL_GRAPH],
      this[INTERNAL_API],
      this[INTERNAL_ID],
      maxDepth,
      currentDepth
    )
  }

  toString(): string {
    const n = this._raw()
    return `[${n.type} "${n.name}" ${n.id}]`
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return this.toString()
  }
}

installBasicNodeProxyAccessors(FigmaNodeProxy.prototype, {
  id: INTERNAL_ID,
  graph: INTERNAL_GRAPH,
  api: INTERNAL_API
})

installVisualNodeProxyAccessors(
  FigmaNodeProxy.prototype,
  { id: INTERNAL_ID, graph: INTERNAL_GRAPH, api: INTERNAL_API },
  MIXED
)

const proxyInternals = {
  id: INTERNAL_ID,
  graph: INTERNAL_GRAPH,
  api: INTERNAL_API
}

installStrokeNodeProxyAccessors(FigmaNodeProxy.prototype, proxyInternals)
installTextNodeProxyAccessors(FigmaNodeProxy.prototype, proxyInternals)
installLayoutNodeProxyAccessors(FigmaNodeProxy.prototype, proxyInternals)
installVariableModeNodeProxyAccessors(FigmaNodeProxy.prototype, proxyInternals)
installComponentPropertyAccessors(FigmaNodeProxy.prototype, proxyInternals)
