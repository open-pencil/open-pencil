import { polygonVertices } from './geometry'
import type { Vector } from './primitives'
import type { SceneNode } from './types'

/**
 * Rounded polygon and star outlines, as Figma draws them. Each corner, convex or not, is rounded by
 * a circular arc tangent to both edges, capped so that it and its neighbours fit along every edge;
 * corner smoothing replaces the arc's ends with curves that ease into the edges, as on rectangles.
 */

/** Figma keeps a polygon's sides or a star's points within this range, and its plugin API clamps to it. */
export const POINT_COUNT_RANGE = { min: 3, max: 60 } as const

export type PolygonOutlineCommand =
  | { type: 'M' | 'L'; x: number; y: number }
  | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: 'Z' }

type PolygonNode = Pick<
  SceneNode,
  | 'type'
  | 'width'
  | 'height'
  | 'pointCount'
  | 'starInnerRadius'
  | 'cornerRadius'
  | 'cornerSmoothing'
>

export interface PolygonCorner {
  vertex: Vector
  /** The unit direction of the edge arriving at the vertex. */
  incoming: Vector
  /** The unit direction of the edge leaving the vertex. */
  outgoing: Vector
  /** How far the outline turns at the vertex, in radians: 0 for a straight line. */
  turn: number
  /** The radius the corner is drawn with, after fitting it along its edges. */
  radius: number
  /** How far along each edge from the vertex the rounding starts. */
  extent: number
}

const sub = (a: Vector, b: Vector): Vector => ({ x: a.x - b.x, y: a.y - b.y })
const along = (point: Vector, direction: Vector, distance: number): Vector => ({
  x: point.x + direction.x * distance,
  y: point.y + direction.y * distance
})

function unit(vector: Vector): Vector {
  const length = Math.hypot(vector.x, vector.y)
  return length > 0 ? { x: vector.x / length, y: vector.y / length } : { x: 0, y: 0 }
}

/** The perpendicular of `direction` on the side the outline turns towards. */
function inward(direction: Vector, towards: Vector): Vector {
  const normal = { x: -direction.y, y: direction.x }
  return normal.x * towards.x + normal.y * towards.y < 0
    ? { x: direction.y, y: -direction.x }
    : normal
}

/**
 * The polygon's or star's corners with the radius each is drawn with. A corner turning by α keeps
 * r·tan(α/2) of each edge, so on an edge of length L between corners turning by α and β the radius
 * is at most L / (tan(α/2) + tan(β/2)); each corner takes the least of its two edges' limits.
 */
export function polygonCorners(node: PolygonNode): PolygonCorner[] {
  const vertices = polygonVertices(node)
  const count = vertices.length
  const at = (index: number) => vertices[(index + count) % count]
  const shape = vertices.map((vertex, index) => {
    const incoming = unit(sub(vertex, at(index - 1)))
    const outgoing = unit(sub(at(index + 1), vertex))
    const cos = Math.min(1, Math.max(-1, incoming.x * outgoing.x + incoming.y * outgoing.y))
    const turn = Math.acos(cos)
    return { vertex, incoming, outgoing, turn, factor: Math.tan(turn / 2) }
  })
  const edgeLimit = (index: number) => {
    const from = shape[(index + count) % count]
    const to = shape[(index + 1 + count) % count]
    const length = Math.hypot(to.vertex.x - from.vertex.x, to.vertex.y - from.vertex.y)
    const factors = from.factor + to.factor
    return factors > 0 ? length / factors : Number.POSITIVE_INFINITY
  }
  const requested = Math.max(0, node.cornerRadius)
  return shape.map(({ factor, ...corner }, index) => {
    const radius = Math.min(requested, edgeLimit(index - 1), edgeLimit(index))
    return { ...corner, radius, extent: radius * factor }
  })
}

interface SmoothCorner {
  /** Where the rounding starts, along each edge from the vertex. */
  p: number
  a: number
  b: number
  c: number
  d: number
  /** The angle each eased end takes from the arc, in radians. */
  ease: number
}

/**
 * Figma's smoothing for a corner turning by any angle: the rectangle construction with the
 * tangent length r·tan(α/2) in place of r and α/2 in place of 45°. Smoothing grows the rounded
 * part of each edge by up to its tangent length again.
 */
function smoothCorner(corner: PolygonCorner, smoothing: number): SmoothCorner {
  const { radius, extent } = corner
  const p = (1 + smoothing) * extent
  const ease = (corner.turn * smoothing) / 2
  const toEase = radius * Math.tan(ease / 2)
  const c = toEase * Math.cos(ease)
  const d = toEase * Math.sin(ease)
  const arcStart = extent - radius * Math.sin(ease) - d
  const b = (p - arcStart - c - d) / 3
  return { p, a: 2 * b, b, c, d, ease }
}

function rotate(direction: Vector, towards: Vector, angle: number): Vector {
  const normal = inward(direction, towards)
  return {
    x: direction.x * Math.cos(angle) + normal.x * Math.sin(angle),
    y: direction.y * Math.cos(angle) + normal.y * Math.sin(angle)
  }
}

function cubic(c1: Vector, c2: Vector, to: Vector): PolygonOutlineCommand {
  return { type: 'C', x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y, x: to.x, y: to.y }
}

/** The rounded corner from where it leaves the incoming edge to where it joins the outgoing one. */
function cornerCommands(corner: PolygonCorner, smooth: SmoothCorner): PolygonOutlineCommand[] {
  const { vertex, incoming, outgoing, radius, turn } = corner
  const { p, a, b, c, d, ease } = smooth
  const back = { x: -incoming.x, y: -incoming.y }
  const start = along(vertex, back, p)
  const end = along(vertex, outgoing, p)
  const normalIn = inward(incoming, outgoing)
  const normalOut = inward(outgoing, back)
  const arcFrom = along(along(start, incoming, a + b + c), normalIn, d)
  const arcTo = along(along(end, outgoing, -(a + b + c)), normalOut, d)
  const commands: PolygonOutlineCommand[] = []
  if (ease > 0)
    commands.push(cubic(along(start, incoming, a), along(start, incoming, a + b), arcFrom))
  const sweep = turn - 2 * ease
  if (sweep > 0) {
    const handle = (4 / 3) * Math.tan(sweep / 4) * radius
    const leaving = rotate(incoming, outgoing, ease)
    const arriving = rotate(outgoing, incoming, ease)
    commands.push(cubic(along(arcFrom, leaving, handle), along(arcTo, arriving, -handle), arcTo))
  }
  if (ease > 0) commands.push(cubic(along(end, outgoing, -(a + b)), along(end, outgoing, -a), end))
  return commands
}

/**
 * The smoothing every corner can take: on each edge a corner may use the part its tangent length
 * takes of both corners' tangent lengths, and Figma lowers smoothing for the whole shape to what
 * its tightest corner allows rather than corner by corner.
 */
function fittedSmoothing(corners: readonly PolygonCorner[], smoothing: number): number {
  const count = corners.length
  const share = (corner: PolygonCorner, neighbour: PolygonCorner) => {
    const length = Math.hypot(
      neighbour.vertex.x - corner.vertex.x,
      neighbour.vertex.y - corner.vertex.y
    )
    return (length * corner.extent) / (corner.extent + neighbour.extent)
  }
  return corners.reduce(
    (fitted, corner, index) => {
      if (!(corner.extent > 0)) return fitted
      const budget = Math.min(
        share(corner, corners[(index - 1 + count) % count]),
        share(corner, corners[(index + 1) % count])
      )
      return Math.min(fitted, budget / corner.extent - 1)
    },
    Math.min(Math.max(smoothing, 0), 1)
  )
}

/** The outline of a polygon or star with its corner radius and smoothing, in its own pixels. */
export function polygonOutline(node: PolygonNode): PolygonOutlineCommand[] {
  const corners = polygonCorners(node)
  const smoothing = Math.max(0, fittedSmoothing(corners, node.cornerSmoothing))
  const commands: PolygonOutlineCommand[] = []
  let current: Vector | null = null
  // Corners whose rounding meets along an edge leave no line between them.
  const lineTo = ({ x, y }: Vector) => {
    if (current && Math.hypot(x - current.x, y - current.y) < 1e-6) return
    commands.push({ type: current ? 'L' : 'M', x, y })
    current = { x, y }
  }
  for (const corner of corners) {
    if (!(corner.radius > 0) || !(corner.turn > 0)) {
      lineTo(corner.vertex)
      continue
    }
    const smooth = smoothCorner(corner, smoothing)
    lineTo(along(corner.vertex, { x: -corner.incoming.x, y: -corner.incoming.y }, smooth.p))
    for (const command of cornerCommands(corner, smooth)) {
      commands.push(command)
      if (command.type === 'C') current = { x: command.x, y: command.y }
    }
  }
  commands.push({ type: 'Z' })
  return commands
}
