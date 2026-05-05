import {
  getFillOkHCL,
  getStrokeOkHCL,
  setNodeFillOkHCL,
  setNodeStrokeOkHCL
} from '#core/color/okhcl'
import type { OkHCLColor, OkHCLPayload } from '#core/color/okhcl'
/* eslint-disable max-lines -- Figma Plugin API proxy; FigmaAPI already in separate file */
import type {
  SceneGraph,
  SceneNode,
  NodeType,
  Fill,
  Stroke,
  Effect,
  LayoutMode
} from '#core/scene-graph'
import type { Rect } from '#core/types'

import { installBasicNodeProxyAccessors } from './accessors/basic'
import { installLayoutNodeProxyAccessors } from './accessors/layout'
import { installVisualNodeProxyAccessors } from './accessors/visual'
import type { FigmaFontName } from './fonts'
import * as PluginData from './plugin-data'
import { nodeProxyToJSON } from './serialization'
import { setFirstStrokeAlign, setFirstStrokeWeight, setIndependentStrokeWeight } from './strokes'
import * as TextProxy from './text'
import * as Traversal from './traversal'

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
  declare resize: (width: number, height: number) => void
  declare resizeWithoutConstraints: (width: number, height: number) => void
  declare readonly absoluteTransform: [[number, number, number], [number, number, number]]
  declare readonly absoluteBoundingBox: Rect
  declare readonly absoluteRenderBounds: Rect

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

  constructor(id: string, graph: SceneGraph, api: NodeProxyHost) {
    this[INTERNAL_ID] = id
    this[INTERNAL_GRAPH] = graph
    this[INTERNAL_API] = api
  }

  private _raw(): SceneNode {
    const n = this[INTERNAL_GRAPH].getNode(this[INTERNAL_ID])
    if (!n) throw new Error(`Node ${this[INTERNAL_ID]} has been removed`)
    return n
  }

  // --- Stroke details ---

  get strokeWeight(): number {
    const s = this._raw().strokes
    return s.length > 0 ? s[0].weight : 0
  }

  set strokeWeight(v: number) {
    setFirstStrokeWeight(this[INTERNAL_GRAPH], this._raw(), v)
  }

  get strokeAlign(): string {
    const s = this._raw().strokes
    return s.length > 0 ? s[0].align : 'INSIDE'
  }

  set strokeAlign(v: string) {
    setFirstStrokeAlign(this[INTERNAL_GRAPH], this._raw(), v)
  }

  get dashPattern(): readonly number[] {
    return Object.freeze([...this._raw().dashPattern])
  }

  set dashPattern(v: readonly number[]) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { dashPattern: [...v] })
  }

  get strokeCap(): string {
    return this._raw().strokeCap
  }

  set strokeCap(v: string) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { strokeCap: v as SceneNode['strokeCap'] })
  }

  get strokeJoin(): string {
    return this._raw().strokeJoin
  }

  set strokeJoin(v: string) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { strokeJoin: v as SceneNode['strokeJoin'] })
  }

  get strokeMiterLimit(): number {
    return this._raw().strokeMiterLimit
  }

  set strokeMiterLimit(v: number) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { strokeMiterLimit: v })
  }

  get strokeTopWeight(): number {
    return this._raw().borderTopWeight
  }

  set strokeTopWeight(v: number) {
    setIndependentStrokeWeight(this[INTERNAL_GRAPH], this[INTERNAL_ID], 'borderTopWeight', v)
  }

  get strokeBottomWeight(): number {
    return this._raw().borderBottomWeight
  }

  set strokeBottomWeight(v: number) {
    setIndependentStrokeWeight(this[INTERNAL_GRAPH], this[INTERNAL_ID], 'borderBottomWeight', v)
  }

  get strokeLeftWeight(): number {
    return this._raw().borderLeftWeight
  }

  set strokeLeftWeight(v: number) {
    setIndependentStrokeWeight(this[INTERNAL_GRAPH], this[INTERNAL_ID], 'borderLeftWeight', v)
  }

  get strokeRightWeight(): number {
    return this._raw().borderRightWeight
  }

  set strokeRightWeight(v: number) {
    setIndependentStrokeWeight(this[INTERNAL_GRAPH], this[INTERNAL_ID], 'borderRightWeight', v)
  }

  // --- Text ---

  get characters(): string {
    return this._raw().text
  }

  set characters(v: string) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { text: v })
  }

  get fontSize(): number {
    return this._raw().fontSize
  }

  set fontSize(v: number) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { fontSize: v })
  }

  get fontName(): FigmaFontName {
    return TextProxy.getFontName(this._raw())
  }

  set fontName(v: FigmaFontName) {
    TextProxy.setFontName(this[INTERNAL_GRAPH], this[INTERNAL_ID], v)
  }

  get fontWeight(): number {
    return this._raw().fontWeight
  }

  set fontWeight(v: number) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { fontWeight: v })
  }

  get textAlignHorizontal(): string {
    return this._raw().textAlignHorizontal
  }

  set textAlignHorizontal(v: string) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], {
      textAlignHorizontal: v as SceneNode['textAlignHorizontal']
    })
  }

  get textDirection(): string {
    return this._raw().textDirection
  }

  set textDirection(v: string) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], {
      textDirection: v as SceneNode['textDirection']
    })
  }

  get textAlignVertical(): string {
    return this._raw().textAlignVertical
  }

  set textAlignVertical(v: string) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], {
      textAlignVertical: v as SceneNode['textAlignVertical']
    })
  }

  get textAutoResize(): string {
    return this._raw().textAutoResize
  }

  set textAutoResize(v: string) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], {
      textAutoResize: v as SceneNode['textAutoResize']
    })
  }

  get letterSpacing(): number {
    return this._raw().letterSpacing
  }

  set letterSpacing(v: number) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { letterSpacing: v })
  }

  get lineHeight(): number | null {
    return this._raw().lineHeight
  }

  set lineHeight(v: number | null) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { lineHeight: v })
  }

  get textCase(): string {
    return this._raw().textCase
  }

  set textCase(v: string) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { textCase: v as SceneNode['textCase'] })
  }

  get textDecoration(): string {
    return this._raw().textDecoration
  }

  set textDecoration(v: string) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], {
      textDecoration: v as SceneNode['textDecoration']
    })
  }

  get maxLines(): number | null {
    return this._raw().maxLines
  }

  set maxLines(v: number | null) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { maxLines: v })
  }

  get textTruncation(): string {
    return this._raw().textTruncation
  }

  set textTruncation(v: string) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], {
      textTruncation: v as SceneNode['textTruncation']
    })
  }

  get autoRename(): boolean {
    return this._raw().autoRename
  }

  set autoRename(v: boolean) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { autoRename: v })
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
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { isMask: v })
  }

  get maskType(): string {
    return this._raw().maskType
  }

  set maskType(v: string) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { maskType: v as SceneNode['maskType'] })
  }

  // --- UI state ---

  get expanded(): boolean {
    return this._raw().expanded
  }

  set expanded(v: boolean) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { expanded: v })
  }

  // --- Components ---

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
    this[INTERNAL_GRAPH].reparentNode(child[INTERNAL_ID], this[INTERNAL_ID])
  }

  insertChild(index: number, child: FigmaNodeProxy): void {
    this[INTERNAL_GRAPH].reparentNode(child[INTERNAL_ID], this[INTERNAL_ID])
    this[INTERNAL_GRAPH].reorderChild(child[INTERNAL_ID], this[INTERNAL_ID], index)
  }

  clone(): FigmaNodeProxy {
    const n = this._raw()
    const parentId = n.parentId ?? this[INTERNAL_API].currentPageId
    const cloned = this[INTERNAL_GRAPH].cloneTree(this[INTERNAL_ID], parentId)
    if (!cloned) throw new Error(`Failed to clone node ${this[INTERNAL_ID]}`)
    return this[INTERNAL_API].wrapNode(cloned.id)
  }

  remove(): void {
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
    PluginData.setPluginData(this[INTERNAL_GRAPH], this._raw(), key, value)
  }

  getPluginDataKeys(): string[] {
    return PluginData.getPluginDataKeys(this._raw())
  }

  getSharedPluginData(namespace: string, key: string): string {
    return PluginData.getSharedPluginData(this._raw(), namespace, key)
  }

  setSharedPluginData(namespace: string, key: string, value: string): void {
    PluginData.setSharedPluginData(this[INTERNAL_GRAPH], this._raw(), namespace, key, value)
  }

  getSharedPluginDataKeys(namespace: string): string[] {
    return PluginData.getSharedPluginDataKeys(this._raw(), namespace)
  }

  getFillOkHCL(index = 0): OkHCLPayload | null {
    return getFillOkHCL(this._raw(), index)
  }

  setFillOkHCL(color: OkHCLColor, index = 0): void {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], setNodeFillOkHCL(this._raw(), index, color))
  }

  getStrokeOkHCL(index = 0): OkHCLPayload | null {
    return getStrokeOkHCL(this._raw(), index)
  }

  setStrokeOkHCL(color: OkHCLColor, index = 0): void {
    this[INTERNAL_GRAPH].updateNode(
      this[INTERNAL_ID],
      setNodeStrokeOkHCL(this._raw(), index, color)
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

installLayoutNodeProxyAccessors(FigmaNodeProxy.prototype, {
  id: INTERNAL_ID,
  graph: INTERNAL_GRAPH,
  api: INTERNAL_API
})
