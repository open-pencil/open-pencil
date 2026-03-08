import { BLACK, DEFAULT_FONT_FAMILY, DEFAULT_STROKE_MITER_LIMIT } from './constants'

export type { GUID, Color } from './types'

export type HandleMirroring = 'NONE' | 'ANGLE' | 'ANGLE_AND_LENGTH'
export type WindingRule = 'NONZERO' | 'EVENODD'

export interface VectorVertex {
  x: number
  y: number
  strokeCap?: string
  strokeJoin?: string
  cornerRadius?: number
  handleMirroring?: HandleMirroring
}

export interface VectorSegment {
  start: number
  end: number
  tangentStart: { x: number; y: number }
  tangentEnd: { x: number; y: number }
}

export interface VectorRegion {
  windingRule: WindingRule
  loops: number[][]
}

export interface VectorNetwork {
  vertices: VectorVertex[]
  segments: VectorSegment[]
  regions: VectorRegion[]
}

export interface GeometryPath {
  windingRule: WindingRule
  commandsBlob: Uint8Array
}

export type NodeType =
  | 'CANVAS'
  | 'FRAME'
  | 'RECTANGLE'
  | 'ROUNDED_RECTANGLE'
  | 'ELLIPSE'
  | 'TEXT'
  | 'LINE'
  | 'STAR'
  | 'POLYGON'
  | 'VECTOR'
  | 'GROUP'
  | 'SECTION'
  | 'COMPONENT'
  | 'COMPONENT_SET'
  | 'INSTANCE'
  | 'CONNECTOR'
  | 'SHAPE_WITH_TEXT'

import type { Color, Matrix, Rect } from './types'

export type FillType =
  | 'SOLID'
  | 'GRADIENT_LINEAR'
  | 'GRADIENT_RADIAL'
  | 'GRADIENT_ANGULAR'
  | 'GRADIENT_DIAMOND'
  | 'IMAGE'
export type BlendMode =
  | 'NORMAL'
  | 'DARKEN'
  | 'MULTIPLY'
  | 'COLOR_BURN'
  | 'LIGHTEN'
  | 'SCREEN'
  | 'COLOR_DODGE'
  | 'OVERLAY'
  | 'SOFT_LIGHT'
  | 'HARD_LIGHT'
  | 'DIFFERENCE'
  | 'EXCLUSION'
  | 'HUE'
  | 'SATURATION'
  | 'COLOR'
  | 'LUMINOSITY'
  | 'PASS_THROUGH'
export type ImageScaleMode = 'FILL' | 'FIT' | 'CROP' | 'TILE'

export interface GradientStop {
  color: Color
  position: number
}

export type GradientTransform = Matrix

export interface Fill {
  type: FillType
  color: Color
  opacity: number
  visible: boolean
  blendMode?: BlendMode
  gradientStops?: GradientStop[]
  gradientTransform?: GradientTransform
  imageHash?: string
  imageScaleMode?: ImageScaleMode
  imageTransform?: GradientTransform
}

export type StrokeCap = 'NONE' | 'ROUND' | 'SQUARE' | 'ARROW_LINES' | 'ARROW_EQUILATERAL'
export type StrokeJoin = 'MITER' | 'BEVEL' | 'ROUND'
export type MaskType = 'ALPHA' | 'VECTOR' | 'LUMINANCE'

export interface Stroke {
  color: Color
  weight: number
  opacity: number
  visible: boolean
  align: 'INSIDE' | 'CENTER' | 'OUTSIDE'
  cap?: StrokeCap
  join?: StrokeJoin
  dashPattern?: number[]
}

export interface Effect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR' | 'FOREGROUND_BLUR'
  color: Color
  offset: { x: number; y: number }
  radius: number
  spread: number
  visible: boolean
  blendMode?: BlendMode
}

export type ConstraintType = 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE'
export type TextAutoResize = 'NONE' | 'HEIGHT' | 'WIDTH_AND_HEIGHT' | 'TRUNCATE'
export type TextAlignVertical = 'TOP' | 'CENTER' | 'BOTTOM'
export type TextCase = 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE'
export type TextDecoration = 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH'

export interface CharacterStyleOverride {
  fontWeight?: number
  italic?: boolean
  textDecoration?: TextDecoration
  fontSize?: number
  fontFamily?: string
  letterSpacing?: number
  lineHeight?: number | null
}

export interface StyleRun {
  start: number
  length: number
  style: CharacterStyleOverride
}

export interface ArcData {
  startingAngle: number
  endingAngle: number
  innerRadius: number
}

export type LayoutMode = 'NONE' | 'HORIZONTAL' | 'VERTICAL' | 'GRID'
export type LayoutSizing = 'FIXED' | 'HUG' | 'FILL'

export type GridTrackSizing = 'FIXED' | 'FR' | 'AUTO'

export interface GridTrack {
  sizing: GridTrackSizing
  value: number
}

export interface GridPosition {
  column: number
  row: number
  columnSpan: number
  rowSpan: number
}
export type LayoutAlign = 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'
export type LayoutCounterAlign = 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'BASELINE'
export type LayoutWrap = 'NO_WRAP' | 'WRAP'

export interface SceneNode {
  id: string
  type: NodeType
  name: string
  parentId: string | null
  childIds: string[]

  x: number
  y: number
  width: number
  height: number
  rotation: number

  fills: Fill[]
  strokes: Stroke[]
  effects: Effect[]
  opacity: number

  cornerRadius: number
  topLeftRadius: number
  topRightRadius: number
  bottomRightRadius: number
  bottomLeftRadius: number
  independentCorners: boolean
  cornerSmoothing: number

  visible: boolean
  locked: boolean
  clipsContent: boolean

  blendMode: BlendMode

  text: string
  fontSize: number
  fontFamily: string
  fontWeight: number
  italic: boolean
  textAlignHorizontal: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED'
  textAlignVertical: TextAlignVertical
  textAutoResize: TextAutoResize
  textCase: TextCase
  textDecoration: TextDecoration
  lineHeight: number | null
  letterSpacing: number
  maxLines: number | null
  styleRuns: StyleRun[]

  horizontalConstraint: ConstraintType
  verticalConstraint: ConstraintType

  layoutMode: LayoutMode
  layoutWrap: LayoutWrap
  primaryAxisAlign: LayoutAlign
  counterAxisAlign: LayoutCounterAlign
  primaryAxisSizing: LayoutSizing
  counterAxisSizing: LayoutSizing
  itemSpacing: number
  counterAxisSpacing: number
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number

  layoutPositioning: 'AUTO' | 'ABSOLUTE'
  layoutGrow: number
  layoutAlignSelf: 'AUTO' | 'STRETCH'

  vectorNetwork: VectorNetwork | null
  fillGeometry: GeometryPath[]
  strokeGeometry: GeometryPath[]

  arcData: ArcData | null

  strokeCap: StrokeCap
  strokeJoin: StrokeJoin
  dashPattern: number[]

  borderTopWeight: number
  borderRightWeight: number
  borderBottomWeight: number
  borderLeftWeight: number
  independentStrokeWeights: boolean

  strokeMiterLimit: number

  minWidth: number | null
  maxWidth: number | null
  minHeight: number | null
  maxHeight: number | null

  isMask: boolean
  maskType: MaskType

  gridTemplateColumns: GridTrack[]
  gridTemplateRows: GridTrack[]
  gridColumnGap: number
  gridRowGap: number
  gridPosition: GridPosition | null

  counterAxisAlignContent: 'AUTO' | 'SPACE_BETWEEN'
  itemReverseZIndex: boolean
  strokesIncludedInLayout: boolean

  expanded: boolean
  textTruncation: 'DISABLED' | 'ENDING'
  autoRename: boolean

  pointCount: number
  starInnerRadius: number

  componentId: string | null
  overrides: Record<string, unknown>

  boundVariables: Record<string, string>

  internalOnly: boolean

  flipX: boolean
  flipY: boolean

  textPicture: Uint8Array | null
}

export type VariableType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN'
export type VariableValue = Color | number | string | boolean | { aliasId: string }

export interface Variable {
  id: string
  name: string
  type: VariableType
  collectionId: string
  valuesByMode: Record<string, VariableValue>
  description: string
  hiddenFromPublishing: boolean
}

export interface VariableCollectionMode {
  modeId: string
  name: string
}

export interface VariableCollection {
  id: string
  name: string
  modes: VariableCollectionMode[]
  defaultModeId: string
  variableIds: string[]
}

let nextLocalID = 1

export function generateId(): string {
  return `0:${nextLocalID++}`
}

function createDefaultNode(type: NodeType, overrides: Partial<SceneNode> = {}): SceneNode {
  return {
    id: generateId(),
    type,
    name: type.charAt(0) + type.slice(1).toLowerCase(),
    parentId: null,
    childIds: [],
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    fills: [],
    strokes: [],
    effects: [],
    opacity: 1,
    cornerRadius: 0,
    topLeftRadius: 0,
    topRightRadius: 0,
    bottomRightRadius: 0,
    bottomLeftRadius: 0,
    independentCorners: false,
    cornerSmoothing: 0,
    visible: true,
    locked: false,
    clipsContent: false,
    text: '',
    fontSize: 14,
    fontFamily: DEFAULT_FONT_FAMILY,
    fontWeight: 400,
    italic: false,
    textAlignHorizontal: 'LEFT',
    lineHeight: null,
    letterSpacing: 0,
    layoutMode: 'NONE',
    layoutWrap: 'NO_WRAP',
    primaryAxisAlign: 'MIN',
    counterAxisAlign: 'MIN',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    itemSpacing: 0,
    counterAxisSpacing: 0,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    blendMode: 'PASS_THROUGH',
    layoutPositioning: 'AUTO',
    layoutGrow: 0,
    layoutAlignSelf: 'AUTO',
    vectorNetwork: null,
    fillGeometry: [],
    strokeGeometry: [],
    arcData: null,
    textAlignVertical: 'TOP',
    textAutoResize: 'NONE',
    textCase: 'ORIGINAL',
    textDecoration: 'NONE',
    maxLines: null,
    styleRuns: [],
    horizontalConstraint: 'MIN',
    verticalConstraint: 'MIN',
    strokeCap: 'NONE',
    strokeJoin: 'MITER',
    dashPattern: [],
    borderTopWeight: 0,
    borderRightWeight: 0,
    borderBottomWeight: 0,
    borderLeftWeight: 0,
    independentStrokeWeights: false,
    strokeMiterLimit: DEFAULT_STROKE_MITER_LIMIT,
    minWidth: null,
    maxWidth: null,
    minHeight: null,
    maxHeight: null,
    isMask: false,
    maskType: 'ALPHA',
    gridTemplateColumns: [],
    gridTemplateRows: [],
    gridColumnGap: 0,
    gridRowGap: 0,
    gridPosition: null,
    counterAxisAlignContent: 'AUTO',
    itemReverseZIndex: false,
    strokesIncludedInLayout: false,
    expanded: true,
    textTruncation: 'DISABLED',
    autoRename: true,
    pointCount: 5,
    starInnerRadius: 0.38,
    componentId: null,
    overrides: {},
    boundVariables: {},
    internalOnly: false,
    flipX: false,
    flipY: false,
    textPicture: null,
    ...overrides
  }
}

const CONTAINER_TYPES = new Set<NodeType>([
  'CANVAS',
  'FRAME',
  'GROUP',
  'SECTION',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE'
])

export class SceneGraph {
  nodes = new Map<string, SceneNode>()
  images = new Map<string, Uint8Array>()
  variables = new Map<string, Variable>()
  variableCollections = new Map<string, VariableCollection>()
  activeMode = new Map<string, string>()
  rootId: string
  private absPosCache = new Map<string, { x: number; y: number }>()

  constructor() {
    const root = createDefaultNode('FRAME', {
      name: 'Document',
      width: 0,
      height: 0
    })
    this.rootId = root.id
    this.nodes.set(root.id, root)

    this.addPage('Page 1')
  }

  addPage(name: string): SceneNode {
    return this.createNode('CANVAS', this.rootId, { name, width: 0, height: 0 })
  }

  getPages(includeInternal = false): SceneNode[] {
    return this.getChildren(this.rootId).filter(
      (n) => n.type === 'CANVAS' && (includeInternal || !n.internalOnly)
    )
  }

  getAllNodes(): Iterable<SceneNode> {
    return this.nodes.values()
  }

  getNode(id: string): SceneNode | undefined {
    return this.nodes.get(id)
  }

  // --- Variables ---

  addVariable(variable: Variable): void {
    this.variables.set(variable.id, variable)
    const collection = this.variableCollections.get(variable.collectionId)
    if (collection && !collection.variableIds.includes(variable.id)) {
      collection.variableIds.push(variable.id)
    }
  }

  removeVariable(id: string): void {
    const variable = this.variables.get(id)
    if (!variable) return
    this.variables.delete(id)
    const collection = this.variableCollections.get(variable.collectionId)
    if (collection) {
      collection.variableIds = collection.variableIds.filter((vid) => vid !== id)
    }
    for (const node of this.nodes.values()) {
      for (const [field, varId] of Object.entries(node.boundVariables)) {
        if (varId === id) delete node.boundVariables[field]
      }
    }
  }

  addCollection(collection: VariableCollection): void {
    this.variableCollections.set(collection.id, collection)
    if (!this.activeMode.has(collection.id)) {
      this.activeMode.set(collection.id, collection.defaultModeId)
    }
  }

  createVariable(
    name: string,
    type: VariableType,
    collectionId: string,
    value?: VariableValue
  ): Variable {
    const collection = this.variableCollections.get(collectionId)
    if (!collection) throw new Error(`Collection "${collectionId}" not found`)
    const id = generateId()
    const defaultValue =
      value ??
      (type === 'COLOR' ? { ...BLACK } : type === 'FLOAT' ? 0 : type === 'BOOLEAN' ? false : '')
    const valuesByMode: Record<string, VariableValue> = {}
    for (const mode of collection.modes) {
      valuesByMode[mode.modeId] = structuredClone(defaultValue)
    }
    const variable: Variable = {
      id,
      name,
      type,
      collectionId,
      valuesByMode,
      description: '',
      hiddenFromPublishing: false
    }
    this.addVariable(variable)
    return variable
  }

  createCollection(name: string): VariableCollection {
    const id = generateId()
    const modeId = generateId()
    const collection: VariableCollection = {
      id,
      name,
      modes: [{ modeId, name: 'Mode 1' }],
      defaultModeId: modeId,
      variableIds: []
    }
    this.addCollection(collection)
    return collection
  }

  removeCollection(id: string): void {
    const collection = this.variableCollections.get(id)
    if (collection) {
      for (const varId of [...collection.variableIds]) {
        this.removeVariable(varId)
      }
    }
    this.variableCollections.delete(id)
    this.activeMode.delete(id)
  }

  getActiveModeId(collectionId: string): string {
    const mode = this.activeMode.get(collectionId)
    if (mode) return mode
    const collection = this.variableCollections.get(collectionId)
    return collection?.defaultModeId ?? ''
  }

  setActiveMode(collectionId: string, modeId: string): void {
    this.activeMode.set(collectionId, modeId)
  }

  resolveVariable(
    variableId: string,
    modeId?: string,
    visited?: Set<string>
  ): VariableValue | undefined {
    if (visited?.has(variableId)) return undefined
    const variable = this.variables.get(variableId)
    if (!variable) return undefined
    const resolvedModeId = modeId ?? this.getActiveModeId(variable.collectionId)
    const value = variable.valuesByMode[resolvedModeId]
    if (value === undefined) return undefined
    if (typeof value === 'object' && value !== null && 'aliasId' in value) {
      const seen = visited ?? new Set<string>()
      seen.add(variableId)
      return this.resolveVariable(value.aliasId, undefined, seen)
    }
    return value
  }

  resolveColorVariable(variableId: string): Color | undefined {
    const value = this.resolveVariable(variableId)
    if (value && typeof value === 'object' && 'r' in value) return value as Color
    return undefined
  }

  resolveNumberVariable(variableId: string): number | undefined {
    const value = this.resolveVariable(variableId)
    return typeof value === 'number' ? value : undefined
  }

  getVariablesForCollection(collectionId: string): Variable[] {
    const collection = this.variableCollections.get(collectionId)
    if (!collection) return []
    return collection.variableIds
      .map((id) => this.variables.get(id))
      .filter((v): v is Variable => v !== undefined)
  }

  getVariablesByType(type: VariableType): Variable[] {
    return [...this.variables.values()].filter((v) => v.type === type)
  }

  bindVariable(nodeId: string, field: string, variableId: string): void {
    const node = this.nodes.get(nodeId)
    if (node) node.boundVariables[field] = variableId
  }

  unbindVariable(nodeId: string, field: string): void {
    const node = this.nodes.get(nodeId)
    if (node) delete node.boundVariables[field]
  }

  getChildren(id: string): SceneNode[] {
    const node = this.nodes.get(id)
    if (!node) return []
    return node.childIds
      .map((cid) => this.nodes.get(cid))
      .filter((n): n is SceneNode => n !== undefined)
  }

  isContainer(id: string): boolean {
    const node = this.nodes.get(id)
    return node ? CONTAINER_TYPES.has(node.type) : false
  }

  isDescendant(childId: string, ancestorId: string): boolean {
    let current = this.nodes.get(childId)
    while (current) {
      if (current.id === ancestorId) return true
      current = current.parentId ? this.nodes.get(current.parentId) : undefined
    }
    return false
  }

  clearAbsPosCache(): void {
    this.absPosCache.clear()
  }

  getAbsolutePosition(id: string): { x: number; y: number } {
    const cached = this.absPosCache.get(id)
    if (cached) return cached

    let ax = 0
    let ay = 0
    let current = this.nodes.get(id)
    while (current && current.id !== this.rootId && current.type !== 'CANVAS') {
      ax += current.x
      ay += current.y
      current = current.parentId ? this.nodes.get(current.parentId) : undefined
    }
    const result = { x: ax, y: ay }
    this.absPosCache.set(id, result)
    return result
  }

  getAbsoluteBounds(id: string): Rect {
    const pos = this.getAbsolutePosition(id)
    const node = this.nodes.get(id)
    return {
      x: pos.x,
      y: pos.y,
      width: node?.width ?? 0,
      height: node?.height ?? 0
    }
  }

  createNode(type: NodeType, parentId: string, overrides: Partial<SceneNode> = {}): SceneNode {
    const node = createDefaultNode(type, overrides)
    node.parentId = parentId
    this.nodes.set(node.id, node)

    const parent = this.nodes.get(parentId)
    if (parent) {
      parent.childIds.push(node.id)
    }

    return node
  }

  updateNode(id: string, changes: Partial<SceneNode>): void {
    const node = this.nodes.get(id)
    if (!node) return
    this.absPosCache.clear()
    Object.assign(node, changes)
  }

  reparentNode(nodeId: string, newParentId: string): void {
    const node = this.nodes.get(nodeId)
    if (!node || nodeId === this.rootId) return
    if (this.isDescendant(newParentId, nodeId)) return

    const oldParent = node.parentId ? this.nodes.get(node.parentId) : undefined
    const newParent = this.nodes.get(newParentId)
    if (!newParent) return
    if (node.parentId === newParentId) return

    this.absPosCache.clear()

    // Convert absolute position
    const absPos = this.getAbsolutePosition(nodeId)
    const newParentNode = this.nodes.get(newParentId)
    const newParentAbs =
      newParentId === this.rootId || newParentNode?.type === 'CANVAS'
        ? { x: 0, y: 0 }
        : this.getAbsolutePosition(newParentId)

    // Remove from old parent
    if (oldParent) {
      oldParent.childIds = oldParent.childIds.filter((cid) => cid !== nodeId)
    }

    // Add to new parent
    node.parentId = newParentId
    newParent.childIds.push(nodeId)

    // Adjust position so node stays in same visual place
    node.x = absPos.x - newParentAbs.x
    node.y = absPos.y - newParentAbs.y
  }

  reorderChild(nodeId: string, parentId: string, insertIndex: number): void {
    const node = this.nodes.get(nodeId)
    if (!node) return

    const oldParent = node.parentId ? this.nodes.get(node.parentId) : undefined
    const newParent = this.nodes.get(parentId)
    if (!newParent) return

    // Remove from old parent
    if (oldParent) {
      oldParent.childIds = oldParent.childIds.filter((cid) => cid !== nodeId)
    }

    // If same parent, adjust index since we removed the item
    let idx = insertIndex
    if (
      oldParent === newParent &&
      idx > (oldParent.childIds.indexOf(nodeId) === -1 ? idx : oldParent.childIds.length)
    ) {
      // Already removed above, no adjustment needed
    }

    node.parentId = parentId
    idx = Math.min(idx, newParent.childIds.length)
    newParent.childIds.splice(idx, 0, nodeId)
  }

  deleteNode(id: string): void {
    const node = this.nodes.get(id)
    if (!node || id === this.rootId) return

    if (node.parentId) {
      const parent = this.nodes.get(node.parentId)
      if (parent) {
        parent.childIds = parent.childIds.filter((cid) => cid !== id)
      }
    }

    for (const childId of Array.from(node.childIds)) {
      this.deleteNode(childId)
    }

    this.nodes.delete(id)
  }

  hitTest(px: number, py: number, scopeId?: string): SceneNode | null {
    const scope = scopeId ?? this.rootId
    return this.hitTestChildren(px, py, scope, 0, 0, false)
  }

  hitTestDeep(px: number, py: number, scopeId?: string): SceneNode | null {
    const scope = scopeId ?? this.rootId
    return this.hitTestChildren(px, py, scope, 0, 0, true)
  }

  private static readonly OPAQUE_CONTAINER_TYPES = new Set<NodeType>(['COMPONENT', 'INSTANCE'])

  private static hasVisibleFillOrStroke(node: SceneNode): boolean {
    return (
      node.fills.some((f) => f.visible) ||
      node.strokes.some((s) => s.visible)
    )
  }

  private hitTestChildren(
    px: number,
    py: number,
    parentId: string,
    offsetX: number,
    offsetY: number,
    deep = false
  ): SceneNode | null {
    const parent = this.nodes.get(parentId)
    if (!parent) return null

    if (parent.clipsContent) {
      if (px < offsetX || px > offsetX + parent.width || py < offsetY || py > offsetY + parent.height) {
        return null
      }
    }

    // Reverse order = topmost first
    for (let i = parent.childIds.length - 1; i >= 0; i--) {
      const childId = parent.childIds[i]
      const child = this.nodes.get(childId)
      if (!child || !child.visible) continue

      const ax = offsetX + child.x
      const ay = offsetY + child.y

      if (CONTAINER_TYPES.has(child.type)) {
        // Components/instances: don't recurse unless in deep mode (double-click).
        // Still check fills — empty instances are click-through like frames.
        if (SceneGraph.OPAQUE_CONTAINER_TYPES.has(child.type) && !deep) {
          if (px >= ax && px <= ax + child.width && py >= ay && py <= ay + child.height) {
            const childHit = this.hitTestChildren(px, py, childId, ax, ay, deep)
            if (childHit) return child
            if (SceneGraph.hasVisibleFillOrStroke(child)) return child
          }
          continue
        }

        const deepHit = this.hitTestChildren(px, py, childId, ax, ay, deep)
        if (deepHit) return deepHit

        // Groups are always click-through (only children are hittable).
        // Frames/sections without visible fills or strokes are also click-through.
        if (child.type === 'GROUP') continue
        if (px >= ax && px <= ax + child.width && py >= ay && py <= ay + child.height) {
          if (SceneGraph.hasVisibleFillOrStroke(child)) return child
        }
        continue
      }

      if (px >= ax && px <= ax + child.width && py >= ay && py <= ay + child.height) {
        return child
      }
    }
    return null
  }

  hitTestFrame(
    px: number,
    py: number,
    excludeIds: Set<string>,
    scopeId?: string
  ): SceneNode | null {
    return this.hitTestFrameChildren(px, py, scopeId ?? this.rootId, 0, 0, excludeIds)
  }

  private hitTestFrameChildren(
    px: number,
    py: number,
    parentId: string,
    offsetX: number,
    offsetY: number,
    excludeIds: Set<string>
  ): SceneNode | null {
    const parent = this.nodes.get(parentId)
    if (!parent) return null

    // Deepest matching frame wins
    let best: SceneNode | null = null

    for (const childId of parent.childIds) {
      if (excludeIds.has(childId)) continue
      const child = this.nodes.get(childId)
      if (!child || !child.visible) continue

      const ax = offsetX + child.x
      const ay = offsetY + child.y

      if (!CONTAINER_TYPES.has(child.type)) continue
      if (px < ax || px > ax + child.width || py < ay || py > ay + child.height) continue

      best = child

      const deeper = this.hitTestFrameChildren(px, py, childId, ax, ay, excludeIds)
      if (deeper) best = deeper
    }

    return best
  }

  cloneTree(
    sourceId: string,
    parentId: string,
    overrides: Partial<SceneNode> = {}
  ): SceneNode | null {
    const src = this.nodes.get(sourceId)
    if (!src) return null

    const { id: _srcId, parentId: _srcParent, childIds: _srcChildren, ...rest } = src
    const clone = this.createNode(src.type, parentId, { ...rest, ...overrides })

    for (const childId of src.childIds) {
      this.cloneTree(childId, clone.id)
    }

    return clone
  }

  private static readonly INSTANCE_SYNC_PROPS: (keyof SceneNode)[] = [
    'width',
    'height',
    'fills',
    'strokes',
    'effects',
    'opacity',
    'cornerRadius',
    'topLeftRadius',
    'topRightRadius',
    'bottomRightRadius',
    'bottomLeftRadius',
    'independentCorners',
    'layoutMode',
    'layoutWrap',
    'primaryAxisAlign',
    'counterAxisAlign',
    'primaryAxisSizing',
    'counterAxisSizing',
    'itemSpacing',
    'counterAxisSpacing',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'gridTemplateColumns',
    'gridTemplateRows',
    'gridColumnGap',
    'gridRowGap',
    'gridPosition',
    'clipsContent',
    'independentStrokeWeights',
    'borderTopWeight',
    'borderRightWeight',
    'borderBottomWeight',
    'borderLeftWeight'
  ]

  private static copyProp<K extends keyof SceneNode>(
    target: Partial<SceneNode> | SceneNode,
    source: SceneNode,
    key: K
  ): void {
    const val = source[key]
    target[key] = (Array.isArray(val) ? structuredClone(val) : val) as SceneNode[K]
  }

  createInstance(
    componentId: string,
    parentId: string,
    overrides: Partial<SceneNode> = {}
  ): SceneNode | null {
    const component = this.nodes.get(componentId)
    if (!component || component.type !== 'COMPONENT') return null

    const props: Partial<SceneNode> = { name: component.name, componentId }
    for (const key of SceneGraph.INSTANCE_SYNC_PROPS) {
      SceneGraph.copyProp(props, component, key)
    }

    const instance = this.createNode('INSTANCE', parentId, { ...props, ...overrides })

    this.cloneChildrenWithMapping(component.id, instance.id)

    return instance
  }

  populateInstanceChildren(instanceId: string, componentId: string): void {
    const instance = this.nodes.get(instanceId)
    const component = this.nodes.get(componentId)
    if (!instance || !component || instance.type !== 'INSTANCE') return
    this.cloneChildrenWithMapping(componentId, instanceId)
  }

  private cloneChildrenWithMapping(sourceParentId: string, destParentId: string): void {
    const sourceParent = this.nodes.get(sourceParentId)
    if (!sourceParent) return

    for (const childId of sourceParent.childIds) {
      const src = this.nodes.get(childId)
      if (!src) continue

      const { id: _, parentId: _p, childIds: _c, ...rest } = src
      const clone = this.createNode(src.type, destParentId, {
        ...rest,
        componentId: childId
      })

      if (src.childIds.length > 0) {
        this.cloneChildrenWithMapping(childId, clone.id)
      }
    }
  }

  syncInstances(componentId: string): void {
    const component = this.nodes.get(componentId)
    if (!component || component.type !== 'COMPONENT') return

    for (const instance of this.getInstances(componentId)) {
      // Sync instance-level props (unless overridden)
      for (const key of SceneGraph.INSTANCE_SYNC_PROPS) {
        if (key in instance.overrides) continue
        SceneGraph.copyProp(instance, component, key)
      }

      // Sync children: match by componentId
      this.syncChildren(component.id, instance.id, instance.overrides)
    }
  }

  private syncChildren(
    compParentId: string,
    instParentId: string,
    overrides: Record<string, unknown>
  ): void {
    const compParent = this.nodes.get(compParentId)
    const instParent = this.nodes.get(instParentId)
    if (!compParent || !instParent) return

    const instChildMap = new Map<string, SceneNode>()
    for (const childId of instParent.childIds) {
      const child = this.nodes.get(childId)
      if (child?.componentId) instChildMap.set(child.componentId, child)
    }

    // Add new children from component that don't exist in instance
    for (const compChildId of compParent.childIds) {
      if (!instChildMap.has(compChildId)) {
        const src = this.nodes.get(compChildId)
        if (!src) continue
        const { id: _, parentId: _p, childIds: _c, ...rest } = src
        const clone = this.createNode(src.type, instParentId, {
          ...rest,
          componentId: compChildId
        })
        if (src.childIds.length > 0) {
          this.cloneChildrenWithMapping(compChildId, clone.id)
        }
        instChildMap.set(compChildId, clone)
      }
    }

    // Sync existing children
    for (const compChildId of compParent.childIds) {
      const compChild = this.nodes.get(compChildId)
      const instChild = instChildMap.get(compChildId)
      if (!compChild || !instChild) continue

      for (const key of SceneGraph.INSTANCE_SYNC_PROPS) {
        const overrideKey = `${instChild.id}:${key}`
        if (overrideKey in overrides) continue
        SceneGraph.copyProp(instChild, compChild, key)
      }

      for (const key of ['name', 'text', 'fontSize', 'fontWeight', 'fontFamily'] as const) {
        const overrideKey = `${instChild.id}:${key}`
        if (overrideKey in overrides) continue
        SceneGraph.copyProp(instChild, compChild, key)
      }

      if (compChild.childIds.length > 0) {
        this.syncChildren(compChildId, instChild.id, overrides)
      }
    }

    // Reorder instance children to match component order
    const compChildOrder = compParent.childIds
    instParent.childIds.sort((a, b) => {
      const nodeA = this.nodes.get(a)
      const nodeB = this.nodes.get(b)
      const idxA = nodeA?.componentId ? compChildOrder.indexOf(nodeA.componentId) : -1
      const idxB = nodeB?.componentId ? compChildOrder.indexOf(nodeB.componentId) : -1
      return idxA - idxB
    })
  }

  detachInstance(instanceId: string): void {
    const node = this.nodes.get(instanceId)
    if (!node || node.type !== 'INSTANCE') return
    node.type = 'FRAME'
    node.componentId = null
    node.overrides = {}
  }

  getMainComponent(instanceId: string): SceneNode | undefined {
    const node = this.nodes.get(instanceId)
    if (!node?.componentId) return undefined
    return this.nodes.get(node.componentId)
  }

  getInstances(componentId: string): SceneNode[] {
    const instances: SceneNode[] = []
    for (const node of this.nodes.values()) {
      if (node.type === 'INSTANCE' && node.componentId === componentId) {
        instances.push(node)
      }
    }
    return instances
  }

  flattenTree(parentId?: string, depth = 0): Array<{ node: SceneNode; depth: number }> {
    const id = parentId ?? this.rootId
    const parent = this.nodes.get(id)
    if (!parent) return []

    const result: Array<{ node: SceneNode; depth: number }> = []
    for (const childId of parent.childIds) {
      const child = this.nodes.get(childId)
      if (!child) continue
      result.push({ node: child, depth })
      if (child.childIds.length > 0) {
        result.push(...this.flattenTree(childId, depth + 1))
      }
    }
    return result
  }
}
