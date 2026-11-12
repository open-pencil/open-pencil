import { arrowCapOverflow } from './arrow-caps'
import type { Rect, Vector } from './primitives'
import type { Effect, SceneNode, Stroke, StrokeCap, StrokeJoin, VectorNetwork } from './types'

export { cubicPoint } from './cubic'

export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI
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

/**
 * What shapes how far a layer's stroke reaches past its box: its type, since a line is stroked to
 * one side, and its join and miter limit, for the tips mitered path corners reach.
 */
export interface StrokeShape {
  type?: string
  strokeJoin?: StrokeJoin
  strokeMiterLimit?: number
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
    const align = sided ? stroke.align : 'CENTER'
    let extra = open ? stroke.weight / 2 : 0
    if (line || align === 'OUTSIDE') extra = stroke.weight
    else if (align === 'CENTER') extra = stroke.weight / 2
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

/** The Figma blur radius that draws a Gaussian of `sigma`, the inverse of `blurSigma`. */
export function blurRadiusForSigma(sigma: number): number {
  return Math.max(0, sigma) / BLUR_SIGMA_PER_RADIUS
}

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
