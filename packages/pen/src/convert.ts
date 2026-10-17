import {
  paddingFromShorthand,
  parseAutoLayoutDirection,
  parseCounterAxisAlign,
  parsePrimaryAxisAlign
} from '@open-pencil/scene-graph'
import type {
  Color,
  Effect,
  Fill,
  FillType,
  GradientTransform,
  ImageScaleMode,
  LayoutAlign,
  LayoutCounterAlign,
  LayoutMode,
  LayoutSizing,
  NodeType,
  SceneNode,
  Stroke,
  StrokeCap,
  StrokeJoin,
  TextAlignVertical
} from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'
import { BLACK } from '@open-pencil/scene-graph/constants'
import {
  DEFAULT_GRADIENT_TRANSFORM,
  linearGradientTransform
} from '@open-pencil/scene-graph/gradient'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { bindIfVar, isVarRef, type PenVariable, type VarContext } from './variables'

export interface PenDocument {
  version: string
  children: PenNode[]
  themes?: Record<string, string[]>
  variables?: Record<string, PenVariable>
}

type PenStrokeThickness = number | { top?: number; right?: number; bottom?: number; left?: number }

/**
 * A `.pen` stroke in its nested form. Current Pencil documents write the colour as a plain
 * `stroke` with a sibling `strokeWidth` instead; {@link normalizePenStroke} folds that into this
 * shape so one reader handles both.
 */
interface PenStroke {
  align?: string
  thickness?: PenStrokeThickness
  fill?: string
  join?: string
  cap?: string
}

interface PenEffect {
  type: string
  shadowType?: string
  color?: string
  offset?: Vector
  blur?: number
  spread?: number
}

interface PenGradientStop {
  color: string
  position: number
}

interface PenFillObject {
  type: string
  /** The colour of a plain fill. An image fill carries its paint in `url` instead. */
  color?: string
  enabled?: boolean
  /** Where an image fill keeps its asset, relative to the document. */
  url?: string
  /** How an image fill fits its box: `fit`, `fill`, `crop` or `tile`. */
  mode?: string
  /** Which gradient this is: `linear`, `radial`, `angular` or `diamond`. */
  gradientType?: string
  /** A linear gradient's angle in degrees, turning clockwise from pointing up. */
  rotation?: number
  size?: { width?: number; height?: number }
  colors?: PenGradientStop[]
}

type PenFill = string | PenFillObject | PenFillObject[]
type PenSpacingValue = number | string
type PenPadding =
  | PenSpacingValue
  | [PenSpacingValue, PenSpacingValue]
  | [PenSpacingValue, PenSpacingValue, PenSpacingValue, PenSpacingValue]

export interface PenNode {
  type: string
  id: string
  name?: string
  x?: number
  y?: number
  width?: number | string
  height?: number | string
  fill?: PenFill
  opacity?: number
  enabled?: boolean
  clip?: boolean
  rotation?: number
  flipX?: boolean
  flipY?: boolean
  reusable?: boolean
  cornerRadius?: number | string | (number | string)[]
  /** A colour, or the nested object form. See {@link normalizePenStroke}. */
  stroke?: string | PenStroke
  /** Stroke weight, written beside a plain `stroke` colour by current documents. */
  strokeWidth?: PenStrokeThickness
  strokeAlignment?: string
  strokeLinejoin?: string
  strokeLinecap?: string
  effect?: PenEffect | PenEffect[]
  layout?: string
  /** `absolute` takes the node out of its parent's auto layout flow. */
  layoutPosition?: string
  gap?: number | string
  padding?: PenPadding
  justifyContent?: string
  alignItems?: string
  children?: PenNode[]
  content?: string
  fontFamily?: string
  fontSize?: number
  fontWeight?: string | number
  fontStyle?: string
  lineHeight?: number
  letterSpacing?: number
  textAlign?: string
  textAlignVertical?: string
  textGrowth?: string
  ref?: string
  descendants?: Record<string, Partial<PenNode>>
  slot?: string[]
  geometry?: string
  iconFontName?: string
  iconFontFamily?: string
  weight?: number
  model?: string
  theme?: Record<string, string>
}

function parseFillColor(fill: string | PenFillObject, ctx: VarContext): Color {
  const raw = typeof fill === 'string' ? fill : fill.color
  if (raw === undefined) return { ...BLACK }
  return isVarRef(raw) ? ctx.resolveColor(raw) : parseColor(raw)
}

/** Names the bytes an image asset is stored under, or nothing when it could not be read. */
export type PenImageResolver = (url: string) => string | undefined

/** How a `.pen` image fill fits the box it paints. */
const IMAGE_SCALE_MODES: Record<string, ImageScaleMode> = {
  fit: 'FIT',
  contain: 'FIT',
  cover: 'FILL',
  fill: 'FILL',
  crop: 'CROP',
  tile: 'TILE'
}

/**
 * An image fill keeps its paint and the way it fits its box. The pixels are the caller's to
 * supply: a document names its assets relative to itself, and a renderer only has what the graph
 * holds under `imageHash`.
 */
function convertImageFill(
  item: PenFillObject,
  visible: boolean,
  resolveImage?: PenImageResolver
): Fill {
  const imageHash = item.url === undefined ? undefined : resolveImage?.(item.url)
  const fill: Fill = {
    type: 'IMAGE',
    visible,
    opacity: 1,
    color: { ...BLACK },
    imageScaleMode: IMAGE_SCALE_MODES[item.mode ?? ''] ?? 'FILL'
  }
  if (item.url !== undefined) fill.imageURL = item.url
  if (imageHash !== undefined) fill.imageHash = imageHash
  return fill
}

/** How a `.pen` gradient kind becomes a fill type; a kind not listed here has no equivalent. */
const GRADIENT_FILL_TYPES: Partial<Record<string, FillType>> = {
  linear: 'GRADIENT_LINEAR',
  radial: 'GRADIENT_RADIAL',
  angular: 'GRADIENT_ANGULAR',
  diamond: 'GRADIENT_DIAMOND'
}

/**
 * The transform a `.pen` gradient angle describes.
 *
 * `gradientTransform` maps the layer's unit square to gradient space, where a linear gradient runs
 * from (0, 0.5) to (1, 0.5). The angle turns clockwise from pointing up, as CSS writes
 * `linear-gradient`, so 90 is the engine's identity transform and 180 points down. Those are the
 * two angles that pin the convention down: the documents triaged so far all use 180. The line the
 * gradient spans is placed with the engine's own helper, so an imported angle and a handle dragged
 * in the editor describe the same transform instead of two parallel reconstructions of it.
 */
function gradientTransformFor(rotation: number): GradientTransform {
  const radians = (rotation * Math.PI) / 180
  const along = Math.sin(radians)
  const across = Math.cos(radians)
  // The diagonal the angle's line spans, so the gradient reaches the layer's corners exactly.
  const extent = Math.abs(along) + Math.abs(across)
  const half = { x: (along * extent) / 2, y: (-across * extent) / 2 }
  return linearGradientTransform(
    { x: 0.5 - half.x, y: 0.5 - half.y },
    { x: 0.5 + half.x, y: 0.5 + half.y }
  )
}

/**
 * A gradient fill keeps its stops and its kind. Only a linear gradient's angle is placed exactly;
 * every other kind is drawn centred on the layer, because `.pen` describes their geometry with
 * fields this reader does not interpret yet.
 */
function convertGradientFill(
  item: PenFillObject,
  visible: boolean,
  ctx: VarContext
): Fill | undefined {
  const kind = item.gradientType ?? 'linear'
  const type = GRADIENT_FILL_TYPES[kind]
  if (type === undefined) return undefined
  return {
    type,
    visible,
    opacity: 1,
    color: { ...BLACK },
    gradientStops: (item.colors ?? []).map((stop) => ({
      color: parseFillColor(stop.color, ctx),
      position: stop.position
    })),
    gradientTransform:
      type === 'GRADIENT_LINEAR'
        ? gradientTransformFor(item.rotation ?? 180)
        : { ...DEFAULT_GRADIENT_TRANSFORM }
  }
}

export function convertFill(
  fill: PenFill | undefined,
  ctx: VarContext,
  node?: SceneNode,
  resolveImage?: PenImageResolver
): Fill[] {
  if (fill === undefined) return []
  const fills = Array.isArray(fill) ? fill : [fill]
  return fills.map((item, index) => {
    const visible = typeof item === 'string' ? true : item.enabled !== false
    if (typeof item !== 'string' && item.type === 'image') {
      return convertImageFill(item, visible, resolveImage)
    }
    if (typeof item !== 'string' && item.type === 'gradient') {
      const gradient = convertGradientFill(item, visible, ctx)
      if (gradient) return gradient
    }
    const color = parseFillColor(item, ctx)
    const result: Fill = { type: 'SOLID', visible, opacity: color.a, color }
    if (node) bindIfVar(node, `fills[${index}]`, typeof item === 'string' ? item : item.color, ctx)
    return result
  })
}

/**
 * One stroke, however the document declared it. Current `.pen` files put the colour in `stroke`
 * and the weight in a sibling `strokeWidth`; older ones nest both in an object `stroke`. Returns
 * `undefined` when the node declares no stroke at all.
 */
export function normalizePenStroke(pen: PenNode): PenStroke | undefined {
  const stroke = pen.stroke
  if (stroke === undefined) return undefined
  if (typeof stroke !== 'string') return stroke
  return {
    fill: stroke,
    thickness: pen.strokeWidth ?? 1,
    align: pen.strokeAlignment,
    join: pen.strokeLinejoin,
    cap: pen.strokeLinecap
  }
}

function strokeWeight(stroke: PenStroke): number {
  const thickness = stroke.thickness
  if (typeof thickness === 'number') return thickness
  if (thickness === undefined) return 1
  const sides = Object.values(thickness).filter((side) => typeof side === 'number')
  return sides.length > 0 ? Math.max(...sides) : 1
}

export function convertStroke(
  stroke: PenStroke | undefined,
  ctx: VarContext,
  node?: SceneNode
): Stroke[] {
  if (!stroke) return []
  // A stroke with neither a colour nor a weight has nothing to draw.
  if (!stroke.fill && stroke.thickness === undefined) return []
  // Real documents leave the colour out on dividers: a cell declares a bottom thickness and no
  // paint. A declared weight is a line meant to be seen, so it takes the default line colour.
  let color: Color = { ...BLACK }
  if (stroke.fill) {
    color = isVarRef(stroke.fill) ? ctx.resolveColor(stroke.fill) : parseColor(stroke.fill)
  }
  let align: Stroke['align'] = 'CENTER'
  if (stroke.align === 'inside' || stroke.align === 'inner') align = 'INSIDE'
  else if (stroke.align === 'outside' || stroke.align === 'outer') align = 'OUTSIDE'

  const result: Stroke = {
    type: 'SOLID',
    visible: true,
    color,
    opacity: color.a,
    weight: strokeWeight(stroke),
    align,
    dashPattern: []
  }
  if (node) {
    bindIfVar(node, 'strokes[0]', stroke.fill, ctx)
    if (typeof stroke.thickness === 'object') {
      node.independentStrokeWeights = true
      node.borderTopWeight = stroke.thickness.top ?? 0
      node.borderRightWeight = stroke.thickness.right ?? 0
      node.borderBottomWeight = stroke.thickness.bottom ?? 0
      node.borderLeftWeight = stroke.thickness.left ?? 0
    }
    node.strokeJoin = mapStrokeJoin(stroke.join)
    node.strokeCap = mapStrokeCap(stroke.cap)
  }
  return [result]
}

function mapStrokeJoin(join: string | undefined): StrokeJoin {
  if (join === 'round') return 'ROUND'
  if (join === 'bevel') return 'BEVEL'
  return 'MITER'
}

function mapStrokeCap(cap: string | undefined): StrokeCap {
  if (cap === 'round') return 'ROUND'
  if (cap === 'square') return 'SQUARE'
  return 'NONE'
}

export function convertEffects(effect: PenEffect | PenEffect[] | undefined): Effect[] {
  if (!effect) return []
  const effects = Array.isArray(effect) ? effect : [effect]
  return effects.flatMap((item) => {
    if (item.type !== 'shadow') return []
    const color = item.color ? parseColor(item.color) : { r: 0, g: 0, b: 0, a: 0.25 }
    return [
      {
        type: item.shadowType === 'inner' ? 'INNER_SHADOW' : 'DROP_SHADOW',
        visible: true,
        blendMode: 'NORMAL',
        color,
        offset: item.offset ?? { x: 0, y: 0 },
        radius: item.blur ?? 0,
        spread: item.spread ?? 0
      } satisfies Effect
    ]
  })
}

export function applyCornerRadius(
  node: SceneNode,
  radius: PenNode['cornerRadius'],
  ctx: VarContext
): void {
  if (radius === undefined) return
  if (Array.isArray(radius)) {
    const values = radius.map((value) => parseSize(value, 0, ctx).value)
    node.independentCorners = true
    node.topLeftRadius = values[0] ?? 0
    node.topRightRadius = values[1] ?? 0
    node.bottomRightRadius = values[2] ?? 0
    node.bottomLeftRadius = values[3] ?? 0
    return
  }
  node.cornerRadius = parseSize(radius, 0, ctx).value
}

export function applyPadding(node: SceneNode, padding: PenNode['padding'], ctx?: VarContext): void {
  if (padding === undefined) return
  const resolve = (v: number | string): number =>
    typeof v === 'string' ? (isVarRef(v) && ctx ? ctx.resolveNumber(v) : Number(v) || 0) : v
  Object.assign(
    node,
    paddingFromShorthand(Array.isArray(padding) ? padding.map(resolve) : [resolve(padding)])
  )
}

interface ParsedSize {
  value: number
  sizing: LayoutSizing
  /** Fallback used only when fit_content(N) has no children. */
  fitContentFallback?: number
}

function parseParameterizedFallback(value: string, behavior: string): number | undefined {
  const prefix = `${behavior}(`
  if (!value.startsWith(prefix) || !value.endsWith(')')) return undefined

  const rawFallback = value.slice(prefix.length, -1).trim()
  if (rawFallback === '') return undefined

  const parsedFallback = Number(rawFallback)
  return Number.isFinite(parsedFallback) ? parsedFallback : undefined
}

function parseSizingBehavior(value: string, fallback: number): ParsedSize | undefined {
  if (value === 'fill_container') return { value: fallback, sizing: 'FILL' }
  if (value === 'fit_content') return { value: fallback, sizing: 'HUG' }

  // Older generated .pen files used hug_content as an alias for fit_content.
  if (value === 'hug_content') return { value: fallback, sizing: 'HUG' }

  const fillFallback = parseParameterizedFallback(value, 'fill_container')
  if (fillFallback !== undefined) return { value: fillFallback, sizing: 'FILL' }

  const fitFallback =
    parseParameterizedFallback(value, 'fit_content') ??
    parseParameterizedFallback(value, 'hug_content')
  if (fitFallback !== undefined) {
    return { value: fitFallback, sizing: 'HUG', fitContentFallback: fitFallback }
  }
  return undefined
}

export function parseSize(
  value: number | string | undefined,
  fallback: number,
  ctx?: VarContext
): ParsedSize {
  if (value === undefined) return { value: fallback, sizing: 'FIXED' }
  if (typeof value === 'number') return { value, sizing: 'FIXED' }

  const behavior = parseSizingBehavior(value, fallback)
  if (behavior) return behavior

  if (isVarRef(value) && ctx) return { value: ctx.resolveNumber(value), sizing: 'FIXED' }
  const parsed = Number(value)
  return { value: Number.isFinite(parsed) ? parsed : fallback, sizing: 'FIXED' }
}

export function mapLayoutMode(pen: PenNode): LayoutMode {
  const direction = parseAutoLayoutDirection(pen.layout)
  if (direction) return direction
  return pen.type === 'frame' && pen.layout === undefined ? 'HORIZONTAL' : 'NONE'
}

export function mapJustifyContent(value: string | undefined): LayoutAlign {
  return parsePrimaryAxisAlign(value) ?? 'MIN'
}

export function mapAlignItems(value: string | undefined): LayoutCounterAlign {
  return parseCounterAxisAlign(value) ?? 'MIN'
}

export function mapTextAlign(value: string | undefined): SceneNode['textAlignHorizontal'] {
  if (value === 'center') return 'CENTER'
  if (value === 'right' || value === 'end') return 'RIGHT'
  if (value === 'justified') return 'JUSTIFIED'
  return 'LEFT'
}

export function mapTextAlignVertical(value: string | undefined): TextAlignVertical {
  if (value === 'center') return 'CENTER'
  if (value === 'bottom' || value === 'end') return 'BOTTOM'
  return 'TOP'
}

export function mapFontWeight(value: string | number | undefined): number {
  if (typeof value === 'number') return value
  if (value === 'thin') return 100
  if (value === 'extralight') return 200
  if (value === 'light') return 300
  if (value === 'medium') return 500
  if (value === 'semibold') return 600
  if (value === 'bold') return 700
  if (value === 'extrabold') return 800
  if (value === 'black') return 900
  return 400
}

export function mapNodeType(pen: PenNode): NodeType {
  if (pen.type === 'frame') return pen.reusable ? 'COMPONENT' : 'FRAME'
  if (pen.type === 'rectangle') return 'RECTANGLE'
  if (pen.type === 'ellipse') return 'ELLIPSE'
  if (pen.type === 'text' || pen.type === 'icon_font') return 'TEXT'
  if (pen.type === 'path') return 'VECTOR'
  if (pen.type === 'ref') return 'INSTANCE'
  return 'FRAME'
}
