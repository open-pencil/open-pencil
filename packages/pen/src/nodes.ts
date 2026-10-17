import { fillSizingFields } from '@open-pencil/scene-graph'
import type {
  AxisSizingMode,
  LayoutMode,
  LayoutSizing,
  SceneGraph,
  SceneNode,
  TextAutoResize,
  VectorNetwork
} from '@open-pencil/scene-graph'
import { parseSVGPath } from '@open-pencil/scene-graph/parse-path'

import {
  applyCornerRadius,
  applyPadding,
  convertEffects,
  convertFill,
  convertStroke,
  mapAlignItems,
  mapFontWeight,
  mapJustifyContent,
  mapLayoutMode,
  mapNodeType,
  mapTextAlign,
  mapTextAlignVertical,
  normalizePenStroke,
  parseSize,
  type PenImageResolver,
  type PenNode
} from './convert'
import { applyTheme, bindIfVar, isVarRef, type VarContext } from './variables'

/** Fits a parsed SVG path into the box the document declared for it. */
function scaleVectorNetwork(vn: VectorNetwork, targetW: number, targetH: number): void {
  if (vn.vertices.length === 0) return
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const v of vn.vertices) {
    minX = Math.min(minX, v.x)
    maxX = Math.max(maxX, v.x)
    minY = Math.min(minY, v.y)
    maxY = Math.max(maxY, v.y)
  }
  const vnW = maxX - minX
  const vnH = maxY - minY
  if (vnW < 0.01 || vnH < 0.01) return
  const sx = targetW / vnW
  const sy = targetH / vnH
  if (Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return
  for (const v of vn.vertices) {
    v.x = (v.x - minX) * sx
    v.y = (v.y - minY) * sy
  }
  for (const s of vn.segments) {
    s.tangentStart = { x: s.tangentStart.x * sx, y: s.tangentStart.y * sy }
    s.tangentEnd = { x: s.tangentEnd.x * sx, y: s.tangentEnd.y * sy }
  }
}

function resolveFontFamily(raw: string | undefined, ctx: VarContext): string {
  if (!raw) return 'Inter'
  if (isVarRef(raw)) return ctx.resolveString(raw)
  return raw
}

function buildBaseOverrides(pen: PenNode): Partial<SceneNode> {
  const overrides: Partial<SceneNode> = {
    id: pen.id,
    name: pen.name ?? (pen.type === 'icon_font' ? (pen.iconFontName ?? 'Icon') : pen.type),
    x: pen.x ?? 0,
    y: pen.y ?? 0,
    visible: pen.enabled !== false,
    opacity: pen.opacity ?? 1,
    rotation: pen.rotation ?? 0,
    flipX: pen.flipX ?? false,
    flipY: pen.flipY ?? false,
    clipsContent: pen.clip ?? false,
    layoutPositioning: pen.layoutPosition === 'absolute' ? 'ABSOLUTE' : 'AUTO',
    boundVariables: {}
  }
  return overrides
}

function applyAutoLayout(
  overrides: Partial<SceneNode>,
  layoutMode: LayoutMode,
  pen: PenNode,
  widthSizing: LayoutSizing,
  heightSizing: LayoutSizing,
  ctx?: VarContext
): void {
  overrides.layoutMode = layoutMode
  overrides.primaryAxisAlign = mapJustifyContent(pen.justifyContent)
  overrides.counterAxisAlign = mapAlignItems(pen.alignItems)
  overrides.itemSpacing =
    typeof pen.gap === 'string' && isVarRef(pen.gap) && ctx
      ? ctx.resolveNumber(pen.gap)
      : ((pen.gap ?? 0) as number)

  // Fill is the child's grow or stretch, set with its parent; the frame itself stays fixed.
  const own = (sizing: LayoutSizing): AxisSizingMode => (sizing === 'HUG' ? 'HUG' : 'FIXED')
  if (layoutMode === 'VERTICAL') {
    overrides.primaryAxisSizing = own(heightSizing)
    overrides.counterAxisSizing = own(widthSizing)
  } else {
    overrides.primaryAxisSizing = own(widthSizing)
    overrides.counterAxisSizing = own(heightSizing)
  }
}

/** How a document's text growth becomes the resize behaviour of the node. */
const TEXT_GROWTH_RESIZE: Record<string, TextAutoResize> = {
  'fixed-width': 'HEIGHT',
  // Fixed on both axes, so the box never grows to fit the text.
  'fixed-width-height': 'NONE'
}

function applyTextProps(node: SceneNode, pen: PenNode, ctx: VarContext): void {
  node.text = pen.type === 'icon_font' ? (pen.iconFontName ?? '') : (pen.content ?? '')
  node.fontFamily =
    pen.type === 'icon_font'
      ? (pen.iconFontFamily ?? 'Material Symbols Sharp')
      : resolveFontFamily(pen.fontFamily, ctx)
  node.fontSize = pen.fontSize ?? 14
  node.fontWeight = mapFontWeight(
    pen.fontWeight ?? (pen.type === 'icon_font' ? pen.weight : undefined)
  )
  if (pen.fontStyle === 'italic') node.italic = true
  node.textAlignHorizontal = mapTextAlign(pen.textAlign)
  node.textAlignVertical = mapTextAlignVertical(pen.textAlignVertical)
  if (pen.lineHeight !== undefined) {
    node.lineHeight = pen.lineHeight < 5 ? pen.lineHeight * node.fontSize : pen.lineHeight
  }
  if (pen.letterSpacing !== undefined) node.letterSpacing = pen.letterSpacing
  node.textAutoResize = TEXT_GROWTH_RESIZE[pen.textGrowth ?? ''] ?? 'WIDTH_AND_HEIGHT'
  if (pen.fontFamily && isVarRef(pen.fontFamily)) {
    bindIfVar(node, 'fontFamily', pen.fontFamily, ctx)
  }
}

function resolveSizing(pen: PenNode, ctx: VarContext) {
  const isTextLike = pen.type === 'text' || pen.type === 'icon_font'
  const defaultSize = isTextLike ? 20 : 100
  const defaultW = isTextLike && pen.width === undefined ? 0 : defaultSize
  const w = parseSize(pen.width, defaultW, ctx)
  const h = parseSize(pen.height, defaultSize, ctx)
  const layout = mapLayoutMode(pen)

  if (pen.width === undefined && layout !== 'NONE') w.sizing = 'HUG'
  if (pen.height === undefined && layout !== 'NONE') h.sizing = 'HUG'

  return { w, h, layout, isTextLike }
}

/** Creates one `.pen` node and everything under it. */
// eslint-disable-next-line complexity -- .pen node mapping touches many format-specific fields
export function createSceneNode(
  pen: PenNode,
  parentId: string,
  graph: SceneGraph,
  ctx: VarContext,
  componentIds: Map<string, string>,
  penSources: Map<string, PenNode>,
  resolveImage?: PenImageResolver
): string | null {
  // A prompt node has no editable equivalent.
  if (pen.type === 'prompt') return null
  if (pen.theme) applyTheme(pen.theme, ctx)

  const { w, h, layout, isTextLike } = resolveSizing(pen, ctx)
  const overrides = buildBaseOverrides(pen)
  overrides.width = w.value
  overrides.height = h.value
  const hasChildren = (pen.children?.length ?? 0) > 0
  if (!hasChildren && w.fitContentFallback !== undefined) overrides.minWidth = w.fitContentFallback
  if (!hasChildren && h.fitContentFallback !== undefined) overrides.minHeight = h.fitContentFallback

  const parentLayout = graph.getNode(parentId)?.layoutMode ?? 'NONE'
  if (layout !== 'NONE') {
    const widthSizing =
      parentLayout === 'NONE' && w.sizing === 'FILL' ? ('FIXED' as LayoutSizing) : w.sizing
    const heightSizing =
      parentLayout === 'NONE' && h.sizing === 'FILL' ? ('FIXED' as LayoutSizing) : h.sizing
    applyAutoLayout(overrides, layout, pen, widthSizing, heightSizing, ctx)
  }

  const node = graph.createNode(mapNodeType(pen), parentId, overrides)

  if (pen.fill !== undefined) node.fills = convertFill(pen.fill, ctx, node, resolveImage)
  const stroke = normalizePenStroke(pen)
  if (stroke) node.strokes = convertStroke(stroke, ctx, node)
  node.effects = convertEffects(pen.effect)
  applyCornerRadius(node, pen.cornerRadius, ctx)
  applyPadding(node, pen.padding, ctx)

  // Text without a width resizes to its content, which laying out the document measures.
  if (isTextLike) applyTextProps(node, pen, ctx)

  if (pen.type === 'path' && pen.geometry) {
    const vectorNetwork = parseSVGPath(pen.geometry)
    node.vectorNetwork = vectorNetwork
    scaleVectorNetwork(vectorNetwork, node.width, node.height)
  }

  if (parentLayout !== 'NONE') {
    if (w.sizing === 'FILL') Object.assign(node, fillSizingFields(parentLayout, 'HORIZONTAL'))
    if (h.sizing === 'FILL') Object.assign(node, fillSizingFields(parentLayout, 'VERTICAL'))
  }

  if (pen.reusable) {
    componentIds.set(pen.id, node.id)
    penSources.set(pen.id, pen)
  }

  if (pen.children) {
    pen.children.forEach((child) => {
      createSceneNode(child, node.id, graph, ctx, componentIds, penSources, resolveImage)
    })
  }

  return node.id
}
