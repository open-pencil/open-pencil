/* eslint-disable max-lines -- Figma Plugin API proxy; FigmaAPI already in separate file */
import type {
  SceneGraph,
  SceneNode,
  NodeType,
  Fill,
  Stroke,
  Effect,
  LayoutMode,
} from './scene-graph'
import { normalizeColor } from './color'
import type { Rect } from './types'
import { copyFills, copyStrokes, copyEffects } from './copy'

const MIXED = Symbol('mixed')

export type FigmaFontName = { family: string; style: string }

export function weightToStyleName(weight: number, italic: boolean): string {
  const names: Record<number, string> = {
    100: 'Thin',
    200: 'Extra Light',
    300: 'Light',
    400: 'Regular',
    500: 'Medium',
    600: 'Semi Bold',
    700: 'Bold',
    800: 'Extra Bold',
    900: 'Black'
  }
  const base = names[weight] ?? 'Regular'
  return italic ? `${base} Italic` : base
}

export function styleNameToWeight(style: string): { weight: number; italic: boolean } {
  const lower = style.toLowerCase()
  const italic = lower.includes('italic')
  const clean = lower.replace(/italic/i, '').trim()
  const map: Record<string, number> = {
    thin: 100,
    'extra light': 200,
    'ultra light': 200,
    light: 300,
    regular: 400,
    '': 400,
    medium: 500,
    'semi bold': 600,
    'demi bold': 600,
    bold: 700,
    'extra bold': 800,
    'ultra bold': 800,
    black: 900,
    heavy: 900
  }
  return { weight: map[clean] ?? 400, italic }
}

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

  _parentLayout(): 'HORIZONTAL' | 'VERTICAL' | 'NONE' {
    const n = this._raw()
    if (!n.parentId) return 'NONE'
    const parent = this[INTERNAL_GRAPH].getNode(n.parentId)
    if (!parent) return 'NONE'
    const mode = parent.layoutMode
    return mode === 'HORIZONTAL' || mode === 'VERTICAL' ? mode : 'NONE'
  }

  get id(): string {
    return this[INTERNAL_ID]
  }

  get type(): NodeType {
    return this._raw().type
  }

  get name(): string {
    return this._raw().name
  }

  set name(v: string) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { name: v })
  }

  get removed(): boolean {
    return !this[INTERNAL_GRAPH].getNode(this[INTERNAL_ID])
  }

  // --- Geometry ---

  get x(): number {
    return this._raw().x
  }

  set x(v: number) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { x: v })
  }

  get y(): number {
    return this._raw().y
  }

  set y(v: number) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { y: v })
  }

  get width(): number {
    return this._raw().width
  }

  get height(): number {
    return this._raw().height
  }

  get rotation(): number {
    return this._raw().rotation
  }

  set rotation(v: number) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { rotation: v })
  }

  resize(width: number, height: number): void {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { width, height })
  }

  resizeWithoutConstraints(width: number, height: number): void {
    this.resize(width, height)
  }

  get absoluteTransform(): [[number, number, number], [number, number, number]] {
    const pos = this[INTERNAL_GRAPH].getAbsolutePosition(this[INTERNAL_ID])
    return [
      [1, 0, pos.x],
      [0, 1, pos.y]
    ]
  }

  get absoluteBoundingBox(): Rect {
    return this[INTERNAL_GRAPH].getAbsoluteBounds(this[INTERNAL_ID])
  }

  get absoluteRenderBounds(): Rect {
    return this.absoluteBoundingBox
  }

  // --- Visual ---

  get fills(): readonly Fill[] {
    return Object.freeze(copyFills(this._raw().fills))
  }

  set fills(v: readonly Fill[]) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], {
      fills: v.map((f) => ({
        ...f,
        color: normalizeColor(f.color),
        gradientStops: f.gradientStops?.map((s) => ({ ...s, color: normalizeColor(s.color) }))
      }))
    })
  }

  get strokes(): readonly Stroke[] {
    return Object.freeze(copyStrokes(this._raw().strokes))
  }

  set strokes(v: readonly Stroke[]) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], {
      strokes: v.map((s) => ({ ...s, color: normalizeColor(s.color) }))
    })
  }

  get effects(): readonly Effect[] {
    return Object.freeze(copyEffects(this._raw().effects))
  }

  set effects(v: readonly Effect[]) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], {
      effects: v.map((e) => ({ ...e, color: normalizeColor(e.color) }))
    })
  }

  get opacity(): number {
    return this._raw().opacity
  }

  set opacity(v: number) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { opacity: v })
  }

  get visible(): boolean {
    return this._raw().visible
  }

  set visible(v: boolean) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { visible: v })
  }

  get locked(): boolean {
    return this._raw().locked
  }

  set locked(v: boolean) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { locked: v })
  }

  get blendMode(): string {
    return this._raw().blendMode
  }

  set blendMode(v: string) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { blendMode: v as SceneNode['blendMode'] })
  }

  get clipsContent(): boolean {
    return this._raw().clipsContent
  }

  set clipsContent(v: boolean) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { clipsContent: v })
  }

  // --- Corner Radius ---

  get cornerRadius(): number | typeof MIXED {
    const n = this._raw()
    if (n.independentCorners) return MIXED
    return n.cornerRadius
  }

  set cornerRadius(v: number | typeof MIXED) {
    if (v === MIXED) return
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], {
      cornerRadius: v,
      topLeftRadius: v,
      topRightRadius: v,
      bottomRightRadius: v,
      bottomLeftRadius: v,
      independentCorners: false
    })
  }

  get topLeftRadius(): number {
    return this._raw().topLeftRadius
  }

  set topLeftRadius(v: number) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], {
      topLeftRadius: v,
      independentCorners: true
    })
  }

  get topRightRadius(): number {
    return this._raw().topRightRadius
  }

  set topRightRadius(v: number) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], {
      topRightRadius: v,
      independentCorners: true
    })
  }

  get bottomLeftRadius(): number {
    return this._raw().bottomLeftRadius
  }

  set bottomLeftRadius(v: number) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], {
      bottomLeftRadius: v,
      independentCorners: true
    })
  }

  get bottomRightRadius(): number {
    return this._raw().bottomRightRadius
  }

  set bottomRightRadius(v: number) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], {
      bottomRightRadius: v,
      independentCorners: true
    })
  }

  get cornerSmoothing(): number {
    return this._raw().cornerSmoothing
  }

  set cornerSmoothing(v: number) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { cornerSmoothing: v })
  }

  // --- Stroke details ---

  get strokeWeight(): number {
    const s = this._raw().strokes
    return s.length > 0 ? s[0].weight : 0
  }

  set strokeWeight(v: number) {
    const n = this._raw()
    if (n.strokes.length > 0) {
      const strokes = copyStrokes(n.strokes)
      strokes[0].weight = v
      this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { strokes })
    }
  }

  get strokeAlign(): string {
    const s = this._raw().strokes
    return s.length > 0 ? s[0].align : 'INSIDE'
  }

  set strokeAlign(v: string) {
    const n = this._raw()
    if (n.strokes.length > 0) {
      const strokes = copyStrokes(n.strokes)
      strokes[0].align = v as Stroke['align']
      this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { strokes })
    }
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
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], {
      borderTopWeight: v,
      independentStrokeWeights: true
    })
  }

  get strokeBottomWeight(): number {
    return this._raw().borderBottomWeight
  }

  set strokeBottomWeight(v: number) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], {
      borderBottomWeight: v,
      independentStrokeWeights: true
    })
  }

  get strokeLeftWeight(): number {
    return this._raw().borderLeftWeight
  }

  set strokeLeftWeight(v: number) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], {
      borderLeftWeight: v,
      independentStrokeWeights: true
    })
  }

  get strokeRightWeight(): number {
    return this._raw().borderRightWeight
  }

  set strokeRightWeight(v: number) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], {
      borderRightWeight: v,
      independentStrokeWeights: true
    })
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
    const n = this._raw()
    return { family: n.fontFamily, style: weightToStyleName(n.fontWeight, n.italic) }
  }

  set fontName(v: FigmaFontName) {
    const { weight, italic } = styleNameToWeight(v.style)
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], {
      fontFamily: v.family,
      fontWeight: weight,
      italic
    })
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
    const n = this._raw()
    const text = n.text.slice(0, start) + characters + n.text.slice(start)
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { text })
  }

  deleteCharacters(start: number, end: number): void {
    const n = this._raw()
    const text = n.text.slice(0, start) + n.text.slice(end)
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { text })
  }

  // --- Auto-layout ---

  get layoutMode(): LayoutMode {
    return this._raw().layoutMode
  }

  set layoutMode(v: LayoutMode) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { layoutMode: v })
  }

  get primaryAxisAlignItems(): string {
    return this._raw().primaryAxisAlign
  }

  set primaryAxisAlignItems(v: string) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], {
      primaryAxisAlign: v as SceneNode['primaryAxisAlign']
    })
  }

  get counterAxisAlignItems(): string {
    return this._raw().counterAxisAlign
  }

  set counterAxisAlignItems(v: string) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], {
      counterAxisAlign: v as SceneNode['counterAxisAlign']
    })
  }

  get itemSpacing(): number {
    return this._raw().itemSpacing
  }

  set itemSpacing(v: number) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { itemSpacing: v })
  }

  get counterAxisSpacing(): number {
    return this._raw().counterAxisSpacing
  }

  set counterAxisSpacing(v: number) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { counterAxisSpacing: v })
  }

  get paddingTop(): number {
    return this._raw().paddingTop
  }

  set paddingTop(v: number) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { paddingTop: v })
  }

  get paddingRight(): number {
    return this._raw().paddingRight
  }

  set paddingRight(v: number) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { paddingRight: v })
  }

  get paddingBottom(): number {
    return this._raw().paddingBottom
  }

  set paddingBottom(v: number) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { paddingBottom: v })
  }

  get paddingLeft(): number {
    return this._raw().paddingLeft
  }

  set paddingLeft(v: number) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { paddingLeft: v })
  }

  get layoutWrap(): string {
    return this._raw().layoutWrap
  }

  set layoutWrap(v: string) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { layoutWrap: v as SceneNode['layoutWrap'] })
  }

  get primaryAxisSizingMode(): string {
    return this._raw().primaryAxisSizing === 'HUG' ? 'AUTO' : this._raw().primaryAxisSizing
  }

  set primaryAxisSizingMode(v: string) {
    const mapped = v === 'AUTO' ? 'HUG' : v
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], {
      primaryAxisSizing: mapped as SceneNode['primaryAxisSizing']
    })
  }

  get counterAxisSizingMode(): string {
    return this._raw().counterAxisSizing === 'HUG' ? 'AUTO' : this._raw().counterAxisSizing
  }

  set counterAxisSizingMode(v: string) {
    const mapped = v === 'AUTO' ? 'HUG' : v
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], {
      counterAxisSizing: mapped as SceneNode['counterAxisSizing']
    })
  }

  get counterAxisAlignContent(): string {
    return this._raw().counterAxisAlignContent
  }

  set counterAxisAlignContent(v: string) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], {
      counterAxisAlignContent: v as SceneNode['counterAxisAlignContent']
    })
  }

  get itemReverseZIndex(): boolean {
    return this._raw().itemReverseZIndex
  }

  set itemReverseZIndex(v: boolean) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { itemReverseZIndex: v })
  }

  get strokesIncludedInLayout(): boolean {
    return this._raw().strokesIncludedInLayout
  }

  set strokesIncludedInLayout(v: boolean) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { strokesIncludedInLayout: v })
  }

  // --- Layout child props ---

  get layoutPositioning(): string {
    return this._raw().layoutPositioning
  }

  set layoutPositioning(v: string) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], {
      layoutPositioning: v as SceneNode['layoutPositioning']
    })
  }

  get layoutGrow(): number {
    return this._raw().layoutGrow
  }

  set layoutGrow(v: number) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { layoutGrow: v })
  }

  get layoutAlign(): string {
    const n = this._raw()
    if (n.layoutAlignSelf === 'AUTO') return 'INHERIT'
    return n.layoutAlignSelf
  }

  set layoutAlign(v: string) {
    const mapped = v === 'INHERIT' ? 'AUTO' : v
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], {
      layoutAlignSelf: mapped as SceneNode['layoutAlignSelf']
    })
  }

  get layoutSizingHorizontal(): string {
    const n = this._raw()
    const layout = n.layoutMode !== 'NONE' ? n.layoutMode : this._parentLayout()
    if (layout === 'NONE') return 'FIXED'
    return layout === 'HORIZONTAL' ? n.primaryAxisSizing : n.counterAxisSizing
  }

  set layoutSizingHorizontal(v: string) {
    const n = this._raw()
    const layout = n.layoutMode !== 'NONE' ? n.layoutMode : this._parentLayout()
    const parentLayout = this._parentLayout()
    const isMainAxis = parentLayout === 'HORIZONTAL'
    const updates: Partial<SceneNode> = layout === 'VERTICAL'
      ? { counterAxisSizing: v as SceneNode['counterAxisSizing'] }
      : { primaryAxisSizing: v as SceneNode['primaryAxisSizing'] }
    if (isMainAxis) updates.layoutGrow = v === 'FILL' ? 1 : 0
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], updates)
  }

  get layoutSizingVertical(): string {
    const n = this._raw()
    const layout = n.layoutMode !== 'NONE' ? n.layoutMode : this._parentLayout()
    if (layout === 'NONE') return 'FIXED'
    return layout === 'VERTICAL' ? n.primaryAxisSizing : n.counterAxisSizing
  }

  set layoutSizingVertical(v: string) {
    const n = this._raw()
    const layout = n.layoutMode !== 'NONE' ? n.layoutMode : this._parentLayout()
    const parentLayout = this._parentLayout()
    const isMainAxis = parentLayout === 'VERTICAL'
    const updates: Partial<SceneNode> = layout === 'HORIZONTAL'
      ? { counterAxisSizing: v as SceneNode['counterAxisSizing'] }
      : { primaryAxisSizing: v as SceneNode['primaryAxisSizing'] }
    if (isMainAxis) updates.layoutGrow = v === 'FILL' ? 1 : 0
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], updates)
  }

  // --- Constraints ---

  get constraints(): { horizontal: string; vertical: string } {
    const n = this._raw()
    return { horizontal: n.horizontalConstraint, vertical: n.verticalConstraint }
  }

  set constraints(v: { horizontal: string; vertical: string }) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], {
      horizontalConstraint: v.horizontal as SceneNode['horizontalConstraint'],
      verticalConstraint: v.vertical as SceneNode['verticalConstraint']
    })
  }

  // --- Dimension constraints ---

  get minWidth(): number | null {
    return this._raw().minWidth
  }

  set minWidth(v: number | null) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { minWidth: v })
  }

  get maxWidth(): number | null {
    return this._raw().maxWidth
  }

  set maxWidth(v: number | null) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { maxWidth: v })
  }

  get minHeight(): number | null {
    return this._raw().minHeight
  }

  set minHeight(v: number | null) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { minHeight: v })
  }

  get maxHeight(): number | null {
    return this._raw().maxHeight
  }

  set maxHeight(v: number | null) {
    this[INTERNAL_GRAPH].updateNode(this[INTERNAL_ID], { maxHeight: v })
  }

  // --- Mask ---

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
    const results: FigmaNodeProxy[] = []
    const walk = (id: string) => {
      for (const child of this[INTERNAL_GRAPH].getChildren(id)) {
        const proxy = this[INTERNAL_API].wrapNode(child.id)
        if (!callback || callback(proxy)) results.push(proxy)
        walk(child.id)
      }
    }
    walk(this[INTERNAL_ID])
    return results
  }

  findOne(callback: (node: FigmaNodeProxy) => boolean): FigmaNodeProxy | null {
    const walk = (id: string): FigmaNodeProxy | null => {
      for (const child of this[INTERNAL_GRAPH].getChildren(id)) {
        const proxy = this[INTERNAL_API].wrapNode(child.id)
        if (callback(proxy)) return proxy
        const found = walk(child.id)
        if (found) return found
      }
      return null
    }
    return walk(this[INTERNAL_ID])
  }

  findChild(callback: (node: FigmaNodeProxy) => boolean): FigmaNodeProxy | null {
    for (const child of this[INTERNAL_GRAPH].getChildren(this[INTERNAL_ID])) {
      const proxy = this[INTERNAL_API].wrapNode(child.id)
      if (callback(proxy)) return proxy
    }
    return null
  }

  findChildren(callback?: (node: FigmaNodeProxy) => boolean): FigmaNodeProxy[] {
    return this[INTERNAL_GRAPH]
      .getChildren(this[INTERNAL_ID])
      .map((c) => this[INTERNAL_API].wrapNode(c.id))
      .filter((proxy) => !callback || callback(proxy))
  }

  findAllWithCriteria(criteria: { types?: string[] }): FigmaNodeProxy[] {
    const types = criteria.types ? new Set(criteria.types) : null
    return this.findAll((node) => !types || types.has(node.type))
  }

  // --- Serialization ---

  toJSON(maxDepth?: number, currentDepth = 0): Record<string, unknown> {
    const n = this._raw()
    const obj: Record<string, unknown> = {
      id: n.id,
      type: n.type,
      name: n.name,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height
    }
    if (n.fills.length > 0) obj.fills = n.fills
    if (n.strokes.length > 0) obj.strokes = n.strokes
    if (n.effects.length > 0) obj.effects = n.effects
    if (n.opacity !== 1) obj.opacity = n.opacity
    if (n.cornerRadius > 0) obj.cornerRadius = n.cornerRadius
    if (!n.visible) obj.visible = false
    if (n.text) obj.characters = n.text
    if (n.layoutMode !== 'NONE') {
      obj.layoutMode = n.layoutMode
      obj.itemSpacing = n.itemSpacing
    }
    const children = this[INTERNAL_GRAPH].getChildren(this[INTERNAL_ID])
    if (children.length > 0) {
      if (maxDepth !== undefined && currentDepth >= maxDepth) {
        obj.childCount = children.length
      } else {
        obj.children = children.map((c) => this[INTERNAL_API].wrapNode(c.id).toJSON(maxDepth, currentDepth + 1))
      }
    }
    return obj
  }

  toString(): string {
    const n = this._raw()
    return `[${n.type} "${n.name}" ${n.id}]`
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return this.toString()
  }
}
