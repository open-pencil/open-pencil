import { arrowCapOverflow } from './arrow-caps'
import type { Rect, Vector } from './primitives'
import type {
  ArcData,
  Effect,
  SceneNode,
  Stroke,
  StrokeCap,
  StrokeJoin,
  VectorNetwork
} from './types'

export { cubicPoint } from './cubic'

export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI
}

const FULL_TURN = 2 * Math.PI

/** Layers whose shadows Figma never spreads: a text, boolean, star, polygon or vector. */
const UNSPREAD_TYPES: ReadonlySet<SceneNode['type']> = new Set<SceneNode['type']>([
  'TEXT',
  'BOOLEAN_OPERATION',
  'STAR',
  'POLYGON',
  'VECTOR'
])

/**
 * Whether a layer's shadows take their spread. Figma spreads those of boxes and ellipses, arcs
 * among them, and frames, and counts it in their render bounds; a text, boolean, star, polygon or
 * vector never spreads (Figma desktop, live).
 */
export function shadowSpreads(node: Pick<SceneNode, 'type'>): boolean {
  return !UNSPREAD_TYPES.has(node.type)
}

/** The spread a shadow on `node` takes: its own, or none on a layer Figma never spreads. */
export function shadowSpreadOf(
  node: Pick<SceneNode, 'type'>,
  effect: Pick<Effect, 'spread'>
): number {
  return shadowSpreads(node) ? effect.spread : 0
}

/**
 * Whether a sweep from `start` to `end` is a whole turn: less than 0.001 rad short of one draws the
 * whole ellipse in Figma (desktop, live: 0.00095 short is whole, 0.001 short an arc).
 */
export function sweepsWholeTurn(start: number, end: number): boolean {
  return FULL_TURN - Math.abs(end - start) < 0.001
}

/** Whether an arc sweeps a whole turn, so it is drawn and edited as a whole ellipse or ring. */
export function isWholeArc(arc: Pick<ArcData, 'startingAngle' | 'endingAngle'>): boolean {
  return sweepsWholeTurn(arc.startingAngle, arc.endingAngle)
}

export function rotatePoint(px: number, py: number, cx: number, cy: number, rad: number): Vector {
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    x: cx + (px - cx) * cos - (py - cy) * sin,
    y: cy + (px - cx) * sin + (py - cy) * cos
  }
}

export function rotatedCorners(
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  rotationDeg: number
): [Vector, Vector, Vector, Vector] {
  const rad = degToRad(rotationDeg)
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return [
    { x: cx + -hw * cos - -hh * sin, y: cy + -hw * sin + -hh * cos },
    { x: cx + hw * cos - -hh * sin, y: cy + hw * sin + -hh * cos },
    { x: cx + hw * cos - hh * sin, y: cy + hw * sin + hh * cos },
    { x: cx + -hw * cos - hh * sin, y: cy + -hw * sin + hh * cos }
  ]
}

export function rotatedBBox(
  x: number,
  y: number,
  w: number,
  h: number,
  rotationDeg: number
): { left: number; right: number; top: number; bottom: number; centerX: number; centerY: number } {
  if (rotationDeg === 0) {
    return {
      left: x,
      right: x + w,
      top: y,
      bottom: y + h,
      centerX: x + w / 2,
      centerY: y + h / 2
    }
  }
  const corners = rotatedCorners(x + w / 2, y + h / 2, w / 2, h / 2, rotationDeg)
  let left = Infinity,
    right = -Infinity,
    top = Infinity,
    bottom = -Infinity
  for (const c of corners) {
    left = Math.min(left, c.x)
    right = Math.max(right, c.x)
    top = Math.min(top, c.y)
    bottom = Math.max(bottom, c.y)
  }
  return { left, right, top, bottom, centerX: (left + right) / 2, centerY: (top + bottom) / 2 }
}

export interface VisualBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

type BoundsAccumulator = VisualBounds

function createBoundsAccumulator(): BoundsAccumulator {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
}

function includePoint(bounds: BoundsAccumulator, x: number, y: number): void {
  bounds.minX = Math.min(bounds.minX, x)
  bounds.minY = Math.min(bounds.minY, y)
  bounds.maxX = Math.max(bounds.maxX, x)
  bounds.maxY = Math.max(bounds.maxY, y)
}

function includeRect(bounds: BoundsAccumulator, rect: Rect): void {
  includePoint(bounds, rect.x, rect.y)
  includePoint(bounds, rect.x + rect.width, rect.y + rect.height)
}

/** `bounds` as a rect at its top-left corner. */
export function visualBoundsToRect(bounds: VisualBounds): Rect {
  return {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY
  }
}

function boundsToRect(bounds: BoundsAccumulator): Rect {
  return bounds.minX === Infinity ? { x: 0, y: 0, width: 0, height: 0 } : visualBoundsToRect(bounds)
}

export function computeBounds(items: Iterable<Rect>): Rect {
  const bounds = createBoundsAccumulator()
  for (const item of items) includeRect(bounds, item)
  return boundsToRect(bounds)
}

export function polygonVertices(node: {
  width: number
  height: number
  pointCount: number
  type: string
  starInnerRadius: number
}): Vector[] {
  const cx = node.width / 2
  const cy = node.height / 2
  const rx = node.width / 2
  const ry = node.height / 2
  const pointCount = Math.max(3, node.pointCount)
  const isStar = node.type === 'STAR'
  const innerRatio = isStar ? node.starInnerRadius : 1
  const totalPoints = isStar ? pointCount * 2 : pointCount
  const angleOffset = -Math.PI / 2

  return Array.from({ length: totalPoints }, (_, index) => {
    const angle = angleOffset + (2 * Math.PI * index) / totalPoints
    const isInner = isStar && index % 2 === 1
    const radius = isInner ? innerRatio : 1
    return {
      x: cx + rx * radius * Math.cos(angle),
      y: cy + ry * radius * Math.sin(angle)
    }
  })
}

/** A rectangle's stroke weights, side by side: top, right, bottom, left. */
export type SideWeights = readonly [top: number, right: number, bottom: number, left: number]

type SideStrokeNode = Pick<
  SceneNode,
  | 'independentStrokeWeights'
  | 'borderTopWeight'
  | 'borderRightWeight'
  | 'borderBottomWeight'
  | 'borderLeftWeight'
>

/** The share of a stroke's weight that lies outside the shape it outlines. */
export function strokeAlignShare(align: Stroke['align']): number {
  if (align === 'OUTSIDE') return 1
  if (align === 'CENTER') return 0.5
  return 0
}

/** A layer's own side weights: top, right, bottom, left. */
export function borderWeights(node: SideStrokeNode): SideWeights {
  return [
    node.borderTopWeight,
    node.borderRightWeight,
    node.borderBottomWeight,
    node.borderLeftWeight
  ]
}

/** The weight of each side of `node` under `stroke`, its own when its sides have their own. */
export function strokeSideWeights(
  node: SideStrokeNode,
  stroke: Pick<Stroke, 'weight'>
): SideWeights {
  if (!node.independentStrokeWeights)
    return [stroke.weight, stroke.weight, stroke.weight, stroke.weight]
  return borderWeights(node)
}

/** A stroke's weight, or with sides of their own the widest side, for what is not drawn per side. */
export function strokeWeightOf(
  node: Partial<SideStrokeNode>,
  stroke: Pick<Stroke, 'weight'>
): number {
  if (!node.independentStrokeWeights) return stroke.weight
  return Math.max(
    node.borderTopWeight ?? 0,
    node.borderRightWeight ?? 0,
    node.borderBottomWeight ?? 0,
    node.borderLeftWeight ?? 0
  )
}

/**
 * How far a layer's visible strokes reach past each side of its box: top, right, bottom, left.
 * With sides of their own each side reaches by its own weight (Figma desktop, live: a 1px outside
 * stroke with a 20px right side bounds a 100 × 100 rectangle at 121 × 102).
 */
export function strokeSideReach(node: SideStrokeNode & Pick<SceneNode, 'strokes'>): SideWeights {
  let reach: SideWeights = [0, 0, 0, 0]
  for (const stroke of node.strokes) {
    if (!stroke.visible) continue
    const share = strokeAlignShare(stroke.align)
    const sides = strokeSideWeights(node, stroke)
    reach = [
      Math.max(reach[0], sides[0] * share),
      Math.max(reach[1], sides[1] * share),
      Math.max(reach[2], sides[2] * share),
      Math.max(reach[3], sides[3] * share)
    ]
  }
  return reach
}

/**
 * What shapes how far a layer's stroke reaches past its box: its type, since a line is stroked to
 * one side, and its join and miter limit, for the tips mitered path corners reach.
 */
export interface StrokeShape extends Partial<SideStrokeNode> {
  type?: string
  strokeJoin?: StrokeJoin
  strokeMiterLimit?: number
}

/** How far past a path a stroke of `weight` reaches, before mitered corners: a line's stroke lies wholly to one side. */
function strokeExtent(
  weight: number,
  align: Stroke['align'],
  line: boolean,
  open: boolean
): number {
  if (line || align === 'OUTSIDE') return weight
  if (align === 'CENTER' || open) return weight / 2
  return 0
}

export function strokeOverflow(
  strokes?: Stroke[],
  fallbackCap?: StrokeCap,
  network?: VectorNetwork | null,
  shape?: StrokeShape
): number {
  const line = shape?.type === 'LINE'
  // Open segments enclose nothing to take a side of, so their strokes draw centred; a network
  // with closed regions still strokes those on their side.
  const enclosed = new Set(network?.regions.flatMap((region) => region.loops.flat()))
  const open = network?.segments.some((_, index) => !enclosed.has(index)) ?? false
  const sided = !network || network.regions.length > 0
  let overflow = 0
  for (const stroke of strokes ?? []) {
    if (!stroke.visible) continue
    const weight = strokeWeightOf(shape ?? {}, stroke)
    const extra = strokeExtent(weight, sided ? stroke.align : 'CENTER', line, open)
    const miter = network
      ? miterRatio(network, stroke.join ?? shape?.strokeJoin, shape?.strokeMiterLimit)
      : 1
    overflow = Math.max(overflow, extra * miter)
  }
  // A line's heads sit on its stroke's middle, half a weight off the line.
  const heads = arrowCapOverflow(strokes, fallbackCap, network)
  return Math.max(overflow, heads > 0 && line ? heads + overflow / 2 : heads)
}

/** The direction a segment leaves `vertex` in, along its handle when it has one. */
function leaving(network: VectorNetwork, index: number, vertex: number): Vector {
  const segment = network.segments[index]
  const atStart = segment.start === vertex
  const handle = atStart ? segment.tangentStart : segment.tangentEnd
  if (handle.x !== 0 || handle.y !== 0) return handle
  const from = network.vertices[vertex]
  const to = network.vertices[atStart ? segment.end : segment.start]
  return { x: to.x - from.x, y: to.y - from.y }
}

/**
 * How far past half the stroke the sharpest mitered corner reaches, as a multiple: a corner of
 * angle θ mitres out to 1/sin(θ/2), unless that passes the miter limit and it bevels instead.
 * Corners are the vertices exactly two segments meet at, as the stroke joins them.
 */
function miterRatio(network: VectorNetwork, join: StrokeJoin | undefined, limit = 4): number {
  const meeting = new Map<number, number[]>()
  for (const [index, segment] of network.segments.entries()) {
    for (const vertex of new Set([segment.start, segment.end])) {
      meeting.set(vertex, [...(meeting.get(vertex) ?? []), index])
    }
  }
  let ratio = 1
  for (const [vertex, indices] of meeting) {
    if (indices.length !== 2) continue
    if ((network.vertices[vertex].strokeJoin ?? join ?? 'MITER') !== 'MITER') continue
    const a = leaving(network, indices[0], vertex)
    const b = leaving(network, indices[1], vertex)
    const lengths = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y)
    if (lengths === 0) continue
    const angle = Math.acos(Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / lengths)))
    const miter = 1 / Math.sin(angle / 2)
    if (miter <= limit) ratio = Math.max(ratio, miter)
  }
  return ratio
}

/**
 * The blur radius Figma draws: a negative one, which only a bound variable can give, draws as no
 * blur, though the layer keeps the value.
 */
export function drawnBlurRadius(radius: number): number {
  return Math.max(0, radius)
}

/**
 * The widest radius an effect blurs by: its radius, or the larger end of a progressive blur,
 * which can start wider than it ends. Bounds and padding that must hold the whole blur use it.
 */
export function widestBlurRadius(effect: Pick<Effect, 'radius' | 'progressive'>): number {
  return Math.max(effect.radius, effect.progressive?.startRadius ?? effect.radius)
}

const BLUR_SIGMA_PER_RADIUS = 0.43

/**
 * The Gaussian sigma that draws a Figma blur radius as Figma does. Measured on Figma 126 exports,
 * layer blur, both shadows, and background blur fall off as a Gaussian of 0.43 × radius; Figma's
 * SVG export writes radius / 2, which is wider (`packages/core/tests/canvas/blur.test.ts`).
 */
export function blurSigma(radius: number): number {
  return drawnBlurRadius(radius) * BLUR_SIGMA_PER_RADIUS
}

/** Skia's Gaussian kernels end at 3 sigma. */
const KERNEL_SIGMAS = 3

/**
 * How far past what it blurs a Gaussian of `sigma` leaves ink on screen: where Skia's kernel
 * ends, and one more pixel holds its rounding.
 */
export function kernelReach(sigma: number): number {
  return sigma > 0 ? Math.ceil(KERNEL_SIGMAS * sigma) + 1 : 0
}

/** How far past what it blurs a Figma blur of `radius` leaves ink on screen (`kernelReach`). */
export function blurReach(radius: number): number {
  return kernelReach(blurSigma(radius))
}

/**
 * The distance, in sigmas, past a straight edge blurred by a Gaussian at which the edge's share
 * drops to `share`: the inverse of the normal tail Q, by Abramowitz and Stegun 26.2.23, which is
 * within 0.00045 of it.
 */
function gaussianTailDistance(share: number): number {
  if (share <= 0) {
    return Number.POSITIVE_INFINITY
  }
  if (share >= 0.5) {
    return 0
  }
  const s = Math.sqrt(-2 * Math.log(share))
  return (
    s -
    (2.515517 + 0.802853 * s + 0.010328 * s * s) /
      (1 + 1.432788 * s + 0.189269 * s * s + 0.001308 * s * s * s)
  )
}

const COLOR_LEVELS = 255

/**
 * How far past its shape a drop shadow of `radius` and colour alpha `alpha` leaves ink on
 * screen. Skia blurs the shape into an 8-bit mask and scales it by `alpha`, so a mask level shows
 * once `alpha` times it rounds to a level: an opaque or half-opaque shadow shows its faintest
 * level, out to where the kernel ends, and a fainter one ends sooner. Measured on CPU raster, the
 * ink ends at 3.0 sigma for alpha 1 and 0.5, 2.4 for 0.25, and 2.1 for 0.1.
 */
export function shadowReach(radius: number, alpha: number): number {
  const sigma = blurSigma(radius)
  const faintestShownLevel = Math.ceil(0.5 / Math.max(alpha, 1 / COLOR_LEVELS))
  const sigmas = Math.min(
    KERNEL_SIGMAS,
    gaussianTailDistance((faintestShownLevel - 1) / COLOR_LEVELS)
  )
  return Math.ceil(sigmas * sigma) + 1
}

/** The Figma blur radius that draws a Gaussian of `sigma`, the inverse of `blurSigma`. */
export function blurRadiusForSigma(sigma: number): number {
  return Math.max(0, sigma) / BLUR_SIGMA_PER_RADIUS
}

/**
 * How far a layer's shadows and blurs reach past each side as Figma's render bounds count them:
 * a blur by its radius, a shadow by its radius and spread, moved by its offset. Ink on screen
 * reaches further, to `blurReach`.
 */
export function effectOverflow(effects?: Effect[]) {
  let left = 0
  let right = 0
  let top = 0
  let bottom = 0

  for (const effect of effects ?? []) {
    if (!effect.visible) continue
    if (
      effect.type !== 'DROP_SHADOW' &&
      effect.type !== 'LAYER_BLUR' &&
      effect.type !== 'FOREGROUND_BLUR'
    ) {
      continue
    }
    const blurSpread = drawnBlurRadius(widestBlurRadius(effect)) + effect.spread
    left = Math.max(left, blurSpread + Math.max(0, -effect.offset.x))
    right = Math.max(right, blurSpread + Math.max(0, effect.offset.x))
    top = Math.max(top, blurSpread + Math.max(0, -effect.offset.y))
    bottom = Math.max(bottom, blurSpread + Math.max(0, effect.offset.y))
  }

  return { left, right, top, bottom }
}

export function computeAbsoluteBounds(
  nodes: Iterable<{ id: string; width: number; height: number }>,
  getAbsolutePosition: (id: string) => Vector
): Rect {
  const bounds = createBoundsAccumulator()
  for (const n of nodes) {
    const abs = getAbsolutePosition(n.id)
    includeRect(bounds, { x: abs.x, y: abs.y, width: n.width, height: n.height })
  }
  return boundsToRect(bounds)
}

export function unionVisualBounds(
  a: VisualBounds | null,
  b: VisualBounds | null
): VisualBounds | null {
  if (!a) return b
  if (!b) return a
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY)
  }
}

export function intersectVisualBounds(a: VisualBounds, b: VisualBounds): VisualBounds | null {
  const minX = Math.max(a.minX, b.minX)
  const minY = Math.max(a.minY, b.minY)
  const maxX = Math.min(a.maxX, b.maxX)
  const maxY = Math.min(a.maxY, b.maxY)
  return minX < maxX && minY < maxY ? { minX, minY, maxX, maxY } : null
}

/** The path commands of a Figma geometry blob, by their byte code. */
export const GeometryCommand = { CLOSE: 0, MOVE: 1, LINE: 2, QUAD: 3, CUBIC: 4 } as const
export type GeometryCommand = (typeof GeometryCommand)[keyof typeof GeometryCommand]

/**
 * Coordinate pairs per command: glyph-derived blobs are quad-heavy, so every code needs its
 * count. Unknown codes are null, so readers stop instead of desyncing into coordinate bytes.
 */
function commandCoordCount(command: number): number | null {
  if (command === GeometryCommand.CLOSE) return 0
  if (command === GeometryCommand.MOVE || command === GeometryCommand.LINE) return 1
  if (command === GeometryCommand.QUAD) return 2
  if (command === GeometryCommand.CUBIC) return 3
  return null
}

/**
 * Walks a Figma geometry blob: `visit` gets each command, its coordinates as x, y pairs in one
 * array reused between calls, and the byte offset of the first coordinate. It stops at an
 * unknown command or one cut short.
 */
export function readGeometryBlob(
  blob: Uint8Array,
  visit: (command: GeometryCommand, coords: readonly number[], offset: number) => void
): void {
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength)
  const coords: number[] = []
  let offset = 0
  while (offset < blob.length) {
    const command = blob[offset]
    const count = commandCoordCount(command)
    if (count === null || offset + 1 + count * 8 > blob.length) return
    offset += 1
    coords.length = 0
    for (let i = 0; i < count; i++) {
      coords.push(view.getFloat32(offset + i * 8, true), view.getFloat32(offset + i * 8 + 4, true))
    }
    visit(command as GeometryCommand, coords, offset)
    offset += count * 8
  }
}

export function geometryBlobBounds(paths: Array<{ commandsBlob: Uint8Array }>): Rect | null {
  const bounds = createBoundsAccumulator()
  for (const path of paths) {
    readGeometryBlob(path.commandsBlob, (_, coords) => {
      for (let i = 0; i < coords.length; i += 2) includePoint(bounds, coords[i], coords[i + 1])
    })
  }

  return bounds.minX === Infinity ? null : boundsToRect(bounds)
}

/** How far a text node's underline or strikethrough reaches below its box. */
export function textDecorationOverflow(
  node: Pick<
    SceneNode,
    'type' | 'fontSize' | 'textDecoration' | 'textUnderlineOffset' | 'textDecorationThickness'
  >
): number {
  if (node.type !== 'TEXT' || node.textDecoration === 'NONE') {
    return 0
  }
  const { fontSize } = node
  const underlineOffset = node.textUnderlineOffset ?? fontSize * 0.18
  const thickness = node.textDecorationThickness ?? Math.max(1, fontSize / 16)
  return underlineOffset + thickness + fontSize * 0.35
}
