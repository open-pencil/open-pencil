import type { Effect, Fill, SceneGraph, SceneNode, Stroke } from '@lawha/scene-graph'
import { colorToHex8 } from '@lawha/scene-graph/color'
import type { Rect, Vector } from '@lawha/scene-graph/primitives'

import { readInteractions } from '#core/prototype/model'

/**
 * The handoff spec: every layer of the exported frames as exact numbers, so an agent building
 * the design in any stack has nothing to guess. Values are in CSS pixels at 1x; colours are
 * `#RRGGBB` or `#RRGGBBAA`; positions are relative to the frame being exported (`frame`) and
 * to the parent (`local`).
 */
export interface HandoffSpec {
  version: 1
  generator: 'Lawha'
  units: 'px'
  frames: HandoffNode[]
  fonts: HandoffFont[]
  images: HandoffImage[]
}

export interface HandoffFont {
  family: string
  weights: number[]
  italic: boolean
}

export interface HandoffImage {
  hash: string
  path: string
}

export interface HandoffNode {
  id: string
  name: string
  type: string
  visible: boolean
  frame: Rect
  local: { x: number; y: number; rotation: number }
  opacity?: number
  blendMode?: string
  clipsContent?: boolean
  cornerRadius?: number | [number, number, number, number]
  cornerSmoothing?: number
  fills?: HandoffPaint[]
  strokes?: HandoffStroke
  effects?: HandoffEffect[]
  layout?: HandoffLayout
  child?: HandoffChildLayout
  constraints?: { horizontal: string; vertical: string }
  text?: HandoffText
  component?: { componentId: string | null; kind: 'component' | 'instance' | 'set' }
  mask?: boolean
  interactions?: unknown[]
  children?: HandoffNode[]
}

export type HandoffPaint =
  | { type: 'SOLID'; color: string }
  | {
      type: 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND'
      stops: { position: number; color: string }[]
      transform?: unknown
      opacity: number
    }
  | { type: 'IMAGE'; image: string; scaleMode: string; opacity: number; adjustments?: unknown }
  | { type: string; opacity: number }

export interface HandoffStroke {
  paints: HandoffPaint[]
  weight: number | { top: number; right: number; bottom: number; left: number }
  align: string
  dash?: number[]
  cap?: string
  join?: string
}

export interface HandoffEffect {
  type: string
  visible: boolean
  radius?: number
  spread?: number
  offset?: Vector
  color?: string
}

export interface HandoffLayout {
  mode: 'HORIZONTAL' | 'VERTICAL' | 'GRID'
  direction: string
  wrap: boolean
  gap: number
  crossGap: number
  padding: { top: number; right: number; bottom: number; left: number }
  justify: string
  align: string
  widthSizing: string
  heightSizing: string
}

export interface HandoffChildLayout {
  positioning: 'AUTO' | 'ABSOLUTE'
  grow: number
  alignSelf: string
}

export interface HandoffText {
  characters: string
  fontFamily: string
  fontWeight: number
  fontStyle: string | null
  italic: boolean
  fontSize: number
  lineHeight: { value: number; unit: string } | 'AUTO'
  letterSpacing: { value: number; unit: string }
  alignHorizontal: string
  alignVertical: string
  direction: string
  language: string | null
  autoResize: string
  case: string
  decoration: string
  paragraphSpacing: number
  maxLines: number | null
  /** Ranges of the text whose style differs from the layer's: start and end are character offsets. */
  runs?: unknown[]
}

const round = (value: number) => Math.round(value * 100) / 100

function paint(fill: Fill, imagePaths: Map<string, string>): HandoffPaint | null {
  if (!fill.visible) return null
  if (fill.type === 'SOLID') return { type: 'SOLID', color: colorToHex8(fill.color, fill.opacity) }
  if (fill.type === 'IMAGE') {
    const image = fill.imageHash ? imagePaths.get(fill.imageHash) : undefined
    if (!image) return null
    return {
      type: 'IMAGE',
      image,
      scaleMode: fill.imageScaleMode ?? 'FILL',
      opacity: fill.opacity,
      ...(fill.adjustments ? { adjustments: fill.adjustments } : {})
    }
  }
  if (fill.gradientStops) {
    return {
      type: fill.type as 'GRADIENT_LINEAR',
      stops: fill.gradientStops.map((stop) => ({
        position: round(stop.position),
        color: colorToHex8(stop.color)
      })),
      transform: fill.gradientTransform,
      opacity: fill.opacity
    }
  }
  return { type: fill.type, opacity: fill.opacity }
}

function paints(fills: Fill[] | Stroke[], imagePaths: Map<string, string>): HandoffPaint[] {
  const out: HandoffPaint[] = []
  for (const fill of fills) {
    const p = paint(fill, imagePaths)
    if (p) out.push(p)
  }
  return out
}

function effect(e: Effect): HandoffEffect {
  return {
    type: e.type,
    visible: e.visible,
    radius: round(e.radius),
    spread: round(e.spread),
    offset: { x: round(e.offset.x), y: round(e.offset.y) },
    color: colorToHex8(e.color)
  }
}

function strokes(node: SceneNode, imagePaths: Map<string, string>): HandoffStroke | undefined {
  const list = paints(node.strokes, imagePaths)
  if (list.length === 0) return undefined
  return {
    paints: list,
    weight: node.independentStrokeWeights
      ? {
          top: node.borderTopWeight,
          right: node.borderRightWeight,
          bottom: node.borderBottomWeight,
          left: node.borderLeftWeight
        }
      : node.strokeWeight,
    align: node.strokeAlign,
    ...(node.dashPattern.length > 0 ? { dash: node.dashPattern } : {}),
    cap: node.strokeCap,
    join: node.strokeJoin
  }
}

function layout(node: SceneNode): HandoffLayout | undefined {
  if (node.layoutMode === 'NONE') return undefined
  return {
    mode: node.layoutMode,
    direction: node.layoutDirection,
    wrap: node.layoutWrap === 'WRAP',
    gap: node.itemSpacing,
    crossGap: node.counterAxisSpacing,
    padding: {
      top: node.paddingTop,
      right: node.paddingRight,
      bottom: node.paddingBottom,
      left: node.paddingLeft
    },
    justify: node.primaryAxisAlign,
    align: node.counterAxisAlign,
    widthSizing: node.layoutMode === 'VERTICAL' ? node.counterAxisSizing : node.primaryAxisSizing,
    heightSizing: node.layoutMode === 'VERTICAL' ? node.primaryAxisSizing : node.counterAxisSizing
  }
}

function text(node: SceneNode): HandoffText {
  return {
    characters: node.text,
    fontFamily: node.fontFamily,
    fontWeight: node.fontWeight,
    fontStyle: node.fontStyle,
    italic: node.italic,
    fontSize: node.fontSize,
    lineHeight: node.lineHeight ?? 'AUTO',
    letterSpacing: node.letterSpacing,
    alignHorizontal: node.textAlignHorizontal,
    alignVertical: node.textAlignVertical,
    direction: node.textDirection,
    language: node.textLanguage,
    autoResize: node.textAutoResize,
    case: node.textCase,
    decoration: node.textDecoration,
    paragraphSpacing: node.paragraphSpacing,
    maxLines: node.maxLines,
    ...(node.styleRuns.length > 0 ? { runs: node.styleRuns } : {})
  }
}

function corners(node: SceneNode): HandoffNode['cornerRadius'] {
  if (node.independentCorners) {
    return [node.topLeftRadius, node.topRightRadius, node.bottomRightRadius, node.bottomLeftRadius]
  }
  return node.cornerRadius > 0 ? node.cornerRadius : undefined
}

function componentKind(node: SceneNode): HandoffNode['component'] {
  if (node.type === 'COMPONENT') return { componentId: node.id, kind: 'component' }
  if (node.type === 'COMPONENT_SET') return { componentId: node.id, kind: 'set' }
  if (node.type === 'INSTANCE') return { componentId: node.componentId, kind: 'instance' }
  return undefined
}

interface Context {
  graph: SceneGraph
  origin: Vector
  imagePaths: Map<string, string>
  fonts: Map<string, HandoffFont>
}

function describeAppearance(ctx: Context, node: SceneNode, out: HandoffNode): void {
  if (node.opacity < 1) out.opacity = round(node.opacity)
  if (node.blendMode !== 'PASS_THROUGH' && node.blendMode !== 'NORMAL') {
    out.blendMode = node.blendMode
  }
  if (node.clipsContent) out.clipsContent = true
  const radius = corners(node)
  if (radius !== undefined) out.cornerRadius = radius
  if (node.cornerSmoothing > 0) out.cornerSmoothing = node.cornerSmoothing
  const fills = paints(node.fills, ctx.imagePaths)
  if (fills.length > 0) out.fills = fills
  const stroke = strokes(node, ctx.imagePaths)
  if (stroke) out.strokes = stroke
  if (node.effects.length > 0) out.effects = node.effects.map(effect)
  if (node.isMask) out.mask = true
}

function describeLayout(ctx: Context, node: SceneNode, out: HandoffNode): void {
  const auto = layout(node)
  if (auto) out.layout = auto
  const parent = node.parentId ? ctx.graph.getNode(node.parentId) : undefined
  if (parent && parent.layoutMode !== 'NONE') {
    out.child = {
      positioning: node.layoutPositioning,
      grow: node.layoutGrow,
      alignSelf: node.layoutAlignSelf
    }
  } else {
    out.constraints = { horizontal: node.horizontalConstraint, vertical: node.verticalConstraint }
  }
}

function describeText(ctx: Context, node: SceneNode, out: HandoffNode): void {
  out.text = text(node)
  noteFont(ctx, node.fontFamily, node.fontWeight, node.italic)
  for (const run of node.styleRuns) {
    const style = run.style
    noteFont(
      ctx,
      style.fontFamily ?? node.fontFamily,
      style.fontWeight ?? node.fontWeight,
      style.italic ?? node.italic
    )
  }
}

function describe(ctx: Context, node: SceneNode): HandoffNode {
  const abs = ctx.graph.getAbsoluteBounds(node.id)
  const out: HandoffNode = {
    id: node.id,
    name: node.name,
    type: node.type,
    visible: node.visible,
    frame: {
      x: round(abs.x - ctx.origin.x),
      y: round(abs.y - ctx.origin.y),
      width: round(node.width),
      height: round(node.height)
    },
    local: { x: round(node.x), y: round(node.y), rotation: round(node.rotation) }
  }
  describeAppearance(ctx, node, out)
  describeLayout(ctx, node, out)
  if (node.type === 'TEXT') describeText(ctx, node, out)
  const component = componentKind(node)
  if (component) out.component = component
  const interactions = readInteractions(node)
  if (interactions.length > 0) out.interactions = interactions
  const children = node.childIds.flatMap((id) => {
    const child = ctx.graph.getNode(id)
    return child ? [describe(ctx, child)] : []
  })
  if (children.length > 0) out.children = children
  return out
}

function noteFont(ctx: Context, family: string, weight: number, italic: boolean): void {
  const key = `${family}|${italic}`
  const font = ctx.fonts.get(key) ?? { family, weights: [], italic }
  if (!font.weights.includes(weight)) font.weights.push(weight)
  font.weights.sort((a, b) => a - b)
  ctx.fonts.set(key, font)
}

/** Every image the frames use, by hash, with the path the package stores it at. */
export function collectImages(graph: SceneGraph, nodeIds: string[]): Map<string, string> {
  const paths = new Map<string, string>()
  const visit = (id: string) => {
    const node = graph.getNode(id)
    if (!node) return
    for (const fill of [...node.fills, ...node.strokes]) {
      if (fill.type === 'IMAGE' && fill.imageHash && !paths.has(fill.imageHash)) {
        paths.set(
          fill.imageHash,
          `assets/images/${fill.imageHash}.${imageExtension(graph.images.get(fill.imageHash))}`
        )
      }
    }
    for (const child of node.childIds) visit(child)
  }
  for (const id of nodeIds) visit(id)
  return paths
}

function imageExtension(bytes: Uint8Array | undefined): string {
  if (!bytes) return 'png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpg'
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57) return 'webp'
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'gif'
  return 'png'
}

export function buildHandoffSpec(
  graph: SceneGraph,
  nodeIds: string[],
  imagePaths: Map<string, string>
): HandoffSpec {
  const fonts = new Map<string, HandoffFont>()
  const frames: HandoffNode[] = []
  for (const id of nodeIds) {
    const node = graph.getNode(id)
    if (!node) continue
    const abs = graph.getAbsoluteBounds(id)
    frames.push(describe({ graph, origin: { x: abs.x, y: abs.y }, imagePaths, fonts }, node))
  }
  return {
    version: 1,
    generator: 'Lawha',
    units: 'px',
    frames,
    fonts: [...fonts.values()],
    images: [...imagePaths].map(([hash, path]) => ({ hash, path }))
  }
}
