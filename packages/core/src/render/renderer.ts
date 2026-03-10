import { parseColor, colorToFill } from '../color'
import { TRANSPARENT } from '../constants'
import { isTreeNode } from './tree'

import type { SceneGraph, SceneNode, NodeType, LayoutMode, GridTrack, Stroke } from '../scene-graph'
import type { TreeNode } from './tree'

const TYPE_MAP: Partial<Record<string, NodeType>> = {
  frame: 'FRAME',
  view: 'FRAME',
  rectangle: 'RECTANGLE',
  rect: 'RECTANGLE',
  ellipse: 'ELLIPSE',
  text: 'TEXT',
  line: 'LINE',
  star: 'STAR',
  polygon: 'POLYGON',
  vector: 'VECTOR',
  group: 'GROUP',
  section: 'SECTION',
  component: 'COMPONENT'
}

const WEIGHT_MAP: Record<string, number> = {
  normal: 400,
  medium: 500,
  bold: 700
}

const ALIGN_MAP: Record<string, SceneNode['primaryAxisAlign']> = {
  start: 'MIN',
  end: 'MAX',
  center: 'CENTER',
  between: 'SPACE_BETWEEN'
}

const COUNTER_ALIGN_MAP: Record<string, 'MIN' | 'MAX' | 'CENTER' | 'STRETCH'> = {
  start: 'MIN',
  end: 'MAX',
  center: 'CENTER',
  stretch: 'STRETCH'
}

const TEXT_ALIGN_MAP: Record<string, SceneNode['textAlignHorizontal']> = {
  left: 'LEFT',
  center: 'CENTER',
  right: 'RIGHT',
  justified: 'JUSTIFIED'
}

const TEXT_AUTO_RESIZE_MAP: Record<string, SceneNode['textAutoResize']> = {
  none: 'NONE',
  width: 'WIDTH_AND_HEIGHT',
  height: 'HEIGHT'
}

function parseStroke(value: string, width: number): Stroke {
  const color = parseColor(value)
  return {
    color,
    opacity: color.a,
    visible: true,
    weight: width,
    align: 'INSIDE'
  }
}

interface RenderOptions {
  x?: number
  y?: number
  parentId?: string
}

export interface RenderResult {
  id: string
  name: string
  type: NodeType
  childIds: string[]
}

export function renderTree(
  graph: SceneGraph,
  tree: TreeNode,
  options: RenderOptions = {}
): RenderResult {
  const parentId = options.parentId ?? graph.getPages()[0].id

  const result = renderNode(graph, tree, parentId)

  if (options.x !== undefined) graph.updateNode(result.id, { x: options.x })
  if (options.y !== undefined) graph.updateNode(result.id, { y: options.y })

  return {
    id: result.id,
    name: result.name,
    type: result.type,
    childIds: result.childIds
  }
}

function renderNode(graph: SceneGraph, tree: TreeNode, parentId: string): SceneNode {
  const nodeType = TYPE_MAP[tree.type]
  if (!nodeType) throw new Error(`Unknown element: <${tree.type}>`)

  const parent = graph.getNode(parentId)
  const parentLayout = parent?.layoutMode ?? 'NONE'

  const isText = nodeType === 'TEXT'
  const overrides = propsToOverrides(tree.props, isText, parentLayout)

  if (isText) {
    const textContent = tree.children.filter((c): c is string => typeof c === 'string').join('')
    if (textContent) overrides.text = textContent
  }

  const node = graph.createNode(nodeType, parentId, overrides)

  for (const child of tree.children) {
    if (typeof child === 'string') continue
    if (isTreeNode(child)) {
      renderNode(graph, child, node.id)
    }
  }

  return node
}

function applySizeOverrides(
  props: Record<string, unknown>,
  o: Partial<SceneNode>,
  parentLayout: SceneNode['layoutMode']
): { w: unknown; h: unknown } {
  const w = props.w ?? props.width
  const h = props.h ?? props.height
  if (typeof w === 'number') o.width = w
  if (typeof h === 'number') o.height = h

  const isParentRow = parentLayout === 'HORIZONTAL'
  const isParentCol = parentLayout === 'VERTICAL'
  const isParentGrid = parentLayout === 'GRID'

  if (w === 'fill') {
    if (isParentGrid) o.layoutAlignSelf = 'STRETCH'
    else if (isParentRow) o.layoutGrow = 1
    else if (isParentCol) o.layoutAlignSelf = 'STRETCH'
    else { o.layoutGrow = 1; o.layoutAlignSelf = 'STRETCH' }
  }
  if (h === 'fill') {
    if (isParentGrid) o.layoutAlignSelf = 'STRETCH'
    else if (isParentCol) o.layoutGrow = 1
    else if (isParentRow) o.layoutAlignSelf = 'STRETCH'
    else o.layoutAlignSelf = 'STRETCH'
  }

  if (props.x !== undefined) o.x = props.x as number
  if (props.y !== undefined) o.y = props.y as number

  const hasExplicitPosition = props.x !== undefined || props.y !== undefined
  const isInsideAutoLayout = parentLayout !== 'NONE'
  if (hasExplicitPosition && isInsideAutoLayout) {
    o.layoutPositioning = 'ABSOLUTE'
  }

  return { w, h }
}

function applyVisualOverrides(props: Record<string, unknown>, o: Partial<SceneNode>): void {
  const bg = props.bg ?? props.fill
  if (typeof bg === 'string') {
    o.fills = [colorToFill(bg)]
  }

  if (typeof props.stroke === 'string') {
    const strokeWidth = (props.strokeWidth as number | undefined) ?? 1
    o.strokes = [parseStroke(props.stroke, strokeWidth)]
  }

  const rounded = props.rounded ?? props.cornerRadius
  if (typeof rounded === 'number') {
    o.cornerRadius = rounded
  }
  if (
    props.roundedTL !== undefined ||
    props.roundedTR !== undefined ||
    props.roundedBL !== undefined ||
    props.roundedBR !== undefined
  ) {
    o.independentCorners = true
    if (props.roundedTL !== undefined) o.topLeftRadius = props.roundedTL as number
    if (props.roundedTR !== undefined) o.topRightRadius = props.roundedTR as number
    if (props.roundedBL !== undefined) o.bottomLeftRadius = props.roundedBL as number
    if (props.roundedBR !== undefined) o.bottomRightRadius = props.roundedBR as number
  }
  if (props.cornerSmoothing !== undefined) o.cornerSmoothing = props.cornerSmoothing as number

  if (props.opacity !== undefined) o.opacity = props.opacity as number
  if (props.rotate !== undefined) o.rotation = props.rotate as number
  if (props.blendMode !== undefined) {
    o.blendMode = (props.blendMode as string).toUpperCase() as SceneNode['blendMode']
  }
  if (props.overflow === 'hidden') o.clipsContent = true
}

function applyPaddingOverrides(props: Record<string, unknown>, o: Partial<SceneNode>): void {
  const p = props.p ?? props.padding
  if (typeof p === 'number') {
    o.paddingTop = p
    o.paddingRight = p
    o.paddingBottom = p
    o.paddingLeft = p
  }
  const px = props.px as number | undefined
  const py = props.py as number | undefined
  if (px !== undefined) {
    o.paddingLeft = px
    o.paddingRight = px
  }
  if (py !== undefined) {
    o.paddingTop = py
    o.paddingBottom = py
  }
  if (props.pt !== undefined) o.paddingTop = props.pt as number
  if (props.pr !== undefined) o.paddingRight = props.pr as number
  if (props.pb !== undefined) o.paddingBottom = props.pb as number
  if (props.pl !== undefined) o.paddingLeft = props.pl as number
}

const PADDING_KEYS = ['p', 'padding', 'px', 'py', 'pt', 'pr', 'pb', 'pl'] as const
const AUTO_LAYOUT_TRIGGER_KEYS = [...PADDING_KEYS, 'justify', 'items'] as const

function hasPaddingProps(props: Record<string, unknown>): boolean {
  return PADDING_KEYS.some((k) => props[k] !== undefined)
}

function hasAutoLayoutTriggerProps(props: Record<string, unknown>): boolean {
  return AUTO_LAYOUT_TRIGGER_KEYS.some((k) => props[k] !== undefined)
}

function parseTrack(token: string): GridTrack {
  if (token.endsWith('fr')) {
    return { sizing: 'FR', value: parseFloat(token) || 1 }
  }
  if (token === 'auto') {
    return { sizing: 'AUTO', value: 0 }
  }
  return { sizing: 'FIXED', value: parseFloat(token) || 0 }
}

function parseTrackList(value: string): GridTrack[] {
  return value.trim().split(/\s+/).map(parseTrack)
}

function applyGridOverrides(
  props: Record<string, unknown>,
  o: Partial<SceneNode>,
  w: unknown,
  h: unknown
): void {
  o.layoutMode = 'GRID'

  if (typeof w === 'number') o.width = w
  if (typeof h === 'number') o.height = h

  if (typeof props.columns === 'string') {
    o.gridTemplateColumns = parseTrackList(props.columns)
  } else if (typeof props.columns === 'number') {
    o.gridTemplateColumns = Array.from({ length: props.columns }, () => ({ sizing: 'FR' as const, value: 1 }))
  }

  if (typeof props.rows === 'string') {
    o.gridTemplateRows = parseTrackList(props.rows)
  } else if (typeof props.rows === 'number') {
    o.gridTemplateRows = Array.from({ length: props.rows }, () => ({ sizing: 'FR' as const, value: 1 }))
  }

  if (typeof props.columnGap === 'number') o.gridColumnGap = props.columnGap
  if (typeof props.rowGap === 'number') o.gridRowGap = props.rowGap
  if (typeof props.gap === 'number') {
    o.gridColumnGap = props.gap
    o.gridRowGap = props.gap
  }

  if (props.rows === undefined && typeof h !== 'number') {
    o.height = 0
  }
}

function applyGridChildOverrides(props: Record<string, unknown>, o: Partial<SceneNode>): void {
  const col = props.colStart ?? props.col
  const row = props.rowStart ?? props.row
  const colSpan = (props.colSpan as number | undefined) ?? 1
  const rowSpan = (props.rowSpan as number | undefined) ?? 1

  if (col !== undefined || row !== undefined) {
    o.gridPosition = {
      column: (col as number | undefined) ?? 0,
      row: (row as number | undefined) ?? 0,
      columnSpan: colSpan,
      rowSpan: rowSpan
    }
  }
}

function applyAutoLayoutSizing(
  o: Partial<SceneNode>,
  props: Record<string, unknown>,
  w: unknown,
  h: unknown
): void {
  const dir = (props.flex as string | undefined) ?? 'col'
  const isVertical = dir === 'col' || dir === 'column'
  o.layoutMode = (isVertical ? 'VERTICAL' : 'HORIZONTAL') as LayoutMode

  o.primaryAxisSizing = 'HUG'
  o.counterAxisSizing = 'HUG'

  const primaryDim = isVertical ? h : w
  const counterDim = isVertical ? w : h

  if (typeof primaryDim === 'number') o.primaryAxisSizing = 'FIXED'
  if (typeof counterDim === 'number') o.counterAxisSizing = 'FIXED'
  if (primaryDim === 'hug') o.primaryAxisSizing = 'HUG'
  if (counterDim === 'hug') o.counterAxisSizing = 'HUG'
}

function applyLayoutOverrides(
  props: Record<string, unknown>,
  o: Partial<SceneNode>,
  w: unknown,
  h: unknown,
  isText: boolean,
  parentLayout: SceneNode['layoutMode']
): void {
  if (props.grid) {
    applyGridOverrides(props, o, w, h)
    applyPaddingOverrides(props, o)
    if (props.grow !== undefined) o.layoutGrow = props.grow as number
    return
  }

  if (parentLayout === 'GRID') {
    applyGridChildOverrides(props, o)
  }

  const needsAutoLayout = props.flex !== undefined || (!isText && hasAutoLayoutTriggerProps(props))

  if (needsAutoLayout) {
    applyAutoLayoutSizing(o, props, w, h)
  }

  if (props.gap !== undefined) o.itemSpacing = props.gap as number

  if (props.wrap) {
    o.layoutWrap = 'WRAP'
    if (props.rowGap !== undefined) o.counterAxisSpacing = props.rowGap as number
  }

  if (props.justify) {
    o.primaryAxisAlign = ALIGN_MAP[props.justify as string] ?? 'MIN'
  }
  if (props.items) {
    o.counterAxisAlign = COUNTER_ALIGN_MAP[props.items as string] ?? 'MIN'
  }

  applyPaddingOverrides(props, o)

  if (props.grow !== undefined) o.layoutGrow = props.grow as number

  if (props.minW !== undefined) o.width = Math.max(o.width ?? 0, props.minW as number)
  if (props.maxW !== undefined) o.width = Math.min(o.width ?? Infinity, props.maxW as number)
}

function applyTextOverrides(
  props: Record<string, unknown>,
  o: Partial<SceneNode>,
  parentLayout: SceneNode['layoutMode']
): void {
  const fontSize = props.size ?? props.fontSize
  if (typeof fontSize === 'number') o.fontSize = fontSize

  const fontFamily = props.font ?? props.fontFamily
  if (typeof fontFamily === 'string') o.fontFamily = fontFamily

  const weight = props.weight ?? props.fontWeight
  if (typeof weight === 'number') {
    o.fontWeight = weight
  } else if (typeof weight === 'string') {
    o.fontWeight = WEIGHT_MAP[weight] ?? 400
  }

  if (typeof props.color === 'string') {
    o.fills = [colorToFill(props.color)]
  }

  if (props.textAlign) {
    o.textAlignHorizontal = TEXT_ALIGN_MAP[props.textAlign as string] ?? 'LEFT'
  }

  const w = props.w ?? props.width
  const hasExplicitWidth = w !== undefined
  const fillsParent = w === 'fill' || (props.grow as number) > 0
  const isInsideAutoLayout = parentLayout !== 'NONE'

  // Coupled with estimateTextSize() in layout.ts — test headless layout after changes.
  if (props.textAutoResize) {
    o.textAutoResize = TEXT_AUTO_RESIZE_MAP[props.textAutoResize as string] ?? 'NONE'
  } else if (hasExplicitWidth || (isInsideAutoLayout && fillsParent)) {
    o.textAutoResize = 'HEIGHT'
  } else {
    o.textAutoResize = 'WIDTH_AND_HEIGHT'
  }
}

function applyShapeAndEffectOverrides(props: Record<string, unknown>, o: Partial<SceneNode>): void {
  if (props.points !== undefined) o.pointCount = props.points as number
  if (props.innerRadius !== undefined) o.starInnerRadius = props.innerRadius as number
  if (props.pointCount !== undefined) o.pointCount = props.pointCount as number

  if (typeof props.shadow === 'string') {
    const parts = props.shadow.split(/\s+/)
    if (parts.length >= 4) {
      const c = parseColor(parts.slice(3).join(' '))
      o.effects = [
        ...(o.effects ?? []),
        {
          type: 'DROP_SHADOW',
          color: c,
          offset: { x: parseFloat(parts[0]), y: parseFloat(parts[1]) },
          radius: parseFloat(parts[2]),
          spread: 0,
          visible: true
        }
      ]
    }
  }

  if (typeof props.blur === 'number') {
    o.effects = [
      ...(o.effects ?? []),
      {
        type: 'LAYER_BLUR',
        radius: props.blur,
        visible: true,
        color: { ...TRANSPARENT },
        offset: { x: 0, y: 0 },
        spread: 0
      }
    ]
  }
}

function propsToOverrides(
  props: Record<string, unknown>,
  isText: boolean,
  parentLayout: SceneNode['layoutMode']
): Partial<SceneNode> {
  const o: Partial<SceneNode> = {}

  if (props.name) o.name = props.name as string

  const { w, h } = applySizeOverrides(props, o, parentLayout)
  applyVisualOverrides(props, o)
  applyLayoutOverrides(props, o, w, h, isText, parentLayout)
  if (isText) applyTextOverrides(props, o, parentLayout)
  applyShapeAndEffectOverrides(props, o)

  return o
}
