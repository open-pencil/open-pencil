import { compact } from 'es-toolkit'

import { arrowCapOverflow, isArrowCap, lineStrokeEnds } from '../arrow-caps'
import { getWorldMatrix } from '../coordinate'
import type { SceneGraph } from '../graph'
import Matrix from '../matrix'
import type { Vector } from '../primitives'
import type { Fill, SceneNode, Stroke } from '../types'
import { hitsArrowHeads } from './heads'
import { containsByWinding, distanceToLines, distanceToSegment } from './point'
import { shapeOutline, type OutlineArea, type ShapeOutline } from './shapes'

/** Points tested along each edge near the point for whether the filled result changes there. */
const EDGE_SAMPLES = 8

/** How far a flattened curve may stray from the shape when nothing tighter is asked for. */
const DEFAULT_TOLERANCE = 0.25

/**
 * Whether a paint makes its layer clickable, as in Figma: a visible paint that shows something.
 * A paint at 0% opacity, or a gradient whose stops are all transparent, does not; 1% does, and
 * the layer's own opacity does not matter.
 */
export function isHitPaint(paint: Fill): boolean {
  if (!paint.visible || !(paint.opacity > 0)) return false
  if (paint.gradientStops) return paint.gradientStops.some((stop) => stop.color.a > 0)
  if (paint.type === 'SOLID') return paint.color.a > 0
  return true
}

function insideArea(area: OutlineArea, point: Vector): boolean {
  return containsByWinding(area.contours, area.windingRule, point)
}

/** A stroke's weight; with independent borders the widest side, for layers without per-side lines. */
function strokeWeightOf(node: SceneNode, stroke: Stroke): number {
  if (node.independentStrokeWeights) {
    return Math.max(
      node.borderTopWeight,
      node.borderRightWeight,
      node.borderBottomWeight,
      node.borderLeftWeight
    )
  }
  return Number.isFinite(stroke.weight) ? stroke.weight : node.strokeWeight
}

/** The farthest a layer's clickable strokes reach outside its box, in its own units. */
export function strokeReach(node: SceneNode): number {
  let reach = 0
  for (const stroke of node.strokes) {
    if (!isHitPaint(stroke)) continue
    const weight = strokeWeightOf(node, stroke)
    // A line's stroke lies a full weight to one side of it.
    const side = node.type === 'LINE' || stroke.align === 'OUTSIDE'
    reach = Math.max(reach, side ? weight : weight / 2)
  }
  // Arrow heads reach past the stroke.
  const hitStrokes = node.strokes.filter(isHitPaint)
  return Math.max(reach, arrowCapOverflow(hitStrokes, node.strokeCap, node.vectorNetwork))
}

function localPoint(graph: SceneGraph, node: SceneNode, px: number, py: number): Vector | null {
  const inverse = Matrix.invert(getWorldMatrix(node, graph))
  if (!inverse) return null
  const [x, y] = Matrix.mapPoints(inverse, [px, py])
  return { x, y }
}

interface Probe {
  inside: boolean
  /** The point in the layer's own coordinates, where its outline has one. */
  local?: Vector
  /**
   * Whether the outline of the filled area passes within `radius` of the point, counting only
   * edges where the filled result changes from one side to the other.
   */
  edgeWithin: (radius: number) => boolean
  /** Each line a stroke follows, measured from the point in canvas units. */
  lines: LineReach[]
  /** Each line's own stroke weight, where sides differ. */
  lineWeights?: number[]
  /** Whether the layer has an area of its own; strokes on lines are always centred. */
  closed: boolean
  /** Strokes centre on the lines whatever their alignment. */
  centered?: boolean
  /** Strokes follow the filled area's outline, for a shape combined from operands. */
  strokeOnEdge?: boolean
  /** Whether the point lies on or within `radius` of the saved outline a stroke fills. */
  strokeAreaWithin?: (radius: number) => boolean
}

/**
 * Whether an outline made of `edges` passes within `radius` of the point, counting a stretch of
 * edge only where `insideAt` changes from one side of it to the other: edges that cancel or that
 * lie hidden inside or outside the result count for nothing.
 */
function changingEdgeWithin(
  edges: Vector[][],
  insideAt: (x: number, y: number) => boolean | null,
  point: Vector,
  radius: number,
  tolerance: number
): boolean {
  const step = Math.max(1e-6, Math.min(tolerance, radius / 4) / 4)
  for (const edge of edges) {
    for (let i = 0; i + 1 < edge.length; i++) {
      const a = edge[i]
      const b = edge[i + 1]
      if (a.x === b.x && a.y === b.y) continue
      if (distanceToSegment(point, a, b) > radius) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const length = Math.hypot(dx, dy)
      const nx = -dy / length
      const ny = dx / length
      // The part of the edge inside the circle, sampled evenly.
      const centre = ((point.x - a.x) * dx + (point.y - a.y) * dy) / (length * length)
      const offset = Math.abs((point.x - a.x) * nx + (point.y - a.y) * ny)
      const half = Math.sqrt(Math.max(0, radius * radius - offset * offset)) / length
      const from = Math.max(0, centre - half)
      const to = Math.min(1, centre + half)
      for (let k = 0; k <= EDGE_SAMPLES; k++) {
        const t = from + ((to - from) * k) / EDGE_SAMPLES
        const qx = a.x + dx * t
        const qy = a.y + dy * t
        const left = insideAt(qx + nx * step, qy + ny * step)
        const right = insideAt(qx - nx * step, qy - ny * step)
        if (left !== null && right !== null && left !== right) return true
      }
    }
  }
  return false
}

/**
 * How a point lies from a line: its distance, and past an open end how far beyond the end it is
 * along the line and how far across it, for a flat cap that paints nothing past the end.
 */
interface LineReach {
  distance: number
  beyond: number
  across: number
}

function measureLine(
  line: Vector[],
  ends: [boolean, boolean] | undefined,
  point: Vector
): LineReach {
  const reach: LineReach = { distance: distanceToLines([line], point), beyond: 0, across: 0 }
  if (!ends || line.length < 2) return reach
  // Past an open end, the point projects beyond the first or last segment.
  const tips: Array<[boolean, Vector, Vector]> = [
    [ends[0], line[0], line[1]],
    [ends[1], line[line.length - 1], line[line.length - 2]]
  ]
  for (const [open, tip, next] of tips) {
    if (!open) continue
    const dx = tip.x - next.x
    const dy = tip.y - next.y
    const length = Math.hypot(dx, dy)
    if (length === 0) continue
    const along = ((point.x - tip.x) * dx + (point.y - tip.y) * dy) / length
    if (along <= 0 || Math.hypot(point.x - tip.x, point.y - tip.y) > reach.distance + 1e-9) continue
    reach.beyond = along
    reach.across = Math.abs((point.x - tip.x) * dy - (point.y - tip.y) * dx) / length
  }
  return reach
}

function probeOutline(outline: ShapeOutline, point: Vector, tolerance: number): Probe {
  const insideAt = (x: number, y: number) =>
    outline.areas.some((area) => insideArea(area, { x, y }))
  const edges = outline.areas.flatMap((area) => area.contours.map(closedLoop))
  const { strokeAreas } = outline
  return {
    inside: insideAt(point.x, point.y),
    local: point,
    edgeWithin: (radius) => changingEdgeWithin(edges, insideAt, point, radius, tolerance),
    lines: outline.lines.map((line, index) => measureLine(line, outline.lineEnds?.[index], point)),
    lineWeights: outline.lineWeights,
    closed: outline.areas.some((area) => area.contours.length > 0),
    centered: outline.strokeCentered,
    strokeAreaWithin: strokeAreas
      ? (radius) =>
          strokeAreas.some((area) => insideArea(area, point)) ||
          changingEdgeWithin(
            strokeAreas.flatMap((area) => area.contours.map(closedLoop)),
            (x, y) => strokeAreas.some((area) => insideArea(area, { x, y })),
            point,
            radius,
            tolerance
          )
      : undefined
  }
}

function closedLoop(contour: Vector[]): Vector[] {
  const first = contour.at(0)
  return first ? [...contour, first] : contour
}

const BOOLEAN_COMBINE: Record<
  NonNullable<SceneNode['booleanOperation']>,
  (hits: boolean[]) => boolean
> = {
  UNION: (hits) => hits.some(Boolean),
  INTERSECT: (hits) => hits.length > 0 && hits.every(Boolean),
  SUBTRACT: ([first = false, ...rest]) => first && !rest.some(Boolean),
  EXCLUDE: (hits) => compact(hits).length % 2 === 1
}

/** The lines an operand draws its outline along, in canvas coordinates. */
function operandEdges(graph: SceneGraph, node: SceneNode, tolerance: number): Vector[][] {
  if (node.type === 'BOOLEAN_OPERATION' && node.fillGeometry.length === 0) {
    return graph
      .getChildren(node.id)
      .filter((child) => child.visible)
      .flatMap((child) => operandEdges(graph, child, tolerance))
  }
  const outline =
    node.type === 'BOOLEAN_OPERATION'
      ? shapeOutline({ ...node, type: 'VECTOR', vectorNetwork: null }, tolerance)
      : shapeOutline(node, tolerance)
  if (!outline) return []
  const world = getWorldMatrix(node, graph)
  const local = [
    ...outline.lines,
    ...outline.areas.flatMap((area) => area.contours.map(closedLoop))
  ]
  return local.map((line) =>
    line.map((point) => {
      const [x, y] = Matrix.mapPoints(world, [point.x, point.y])
      return { x, y }
    })
  )
}

/**
 * A boolean operation without saved geometry, combined from its operands as it draws. Its outline
 * runs along the operand edges where the combined result changes from one side to the other, so
 * edges hidden inside or outside the result count for nothing. Each side is probed at most a
 * quarter of a screen pixel out, so a result thinner than that, which draws no visible pixel, is
 * not seen.
 */
function probeBoolean(
  graph: SceneGraph,
  node: SceneNode,
  px: number,
  py: number,
  tolerance: number
): Probe | null {
  const operands = graph.getChildren(node.id).filter((child) => child.visible)
  if (operands.length === 0) return null
  const combine = BOOLEAN_COMBINE[node.booleanOperation ?? 'UNION']
  const insideAt = (x: number, y: number): boolean | null => {
    const hits: boolean[] = []
    for (const operand of operands) {
      const probe = probeNode(graph, operand, x, y, tolerance)
      if (!probe) return null
      hits.push(probe.inside)
    }
    return combine(hits)
  }
  const inside = insideAt(px, py)
  if (inside === null) return null
  const point = { x: px, y: py }
  const edges = operands.flatMap((operand) => operandEdges(graph, operand, tolerance))
  return {
    inside,
    edgeWithin: (radius) => changingEdgeWithin(edges, insideAt, point, radius, tolerance),
    lines: [],
    closed: true,
    strokeOnEdge: true
  }
}

function probeNode(
  graph: SceneGraph,
  node: SceneNode,
  px: number,
  py: number,
  tolerance: number
): Probe | null {
  if (node.type === 'BOOLEAN_OPERATION' && node.fillGeometry.length === 0) {
    return probeBoolean(graph, node, px, py, tolerance)
  }
  const outline =
    node.type === 'BOOLEAN_OPERATION'
      ? shapeOutline({ ...node, type: 'VECTOR', vectorNetwork: null }, tolerance)
      : shapeOutline(node, tolerance)
  if (!outline) return null
  const point = localPoint(graph, node, px, py)
  return point ? probeOutline(outline, point, tolerance) : null
}

/** How far from a line a stroke's band reaches toward the point, beyond which it misses. */
function strokeReachAt(align: Stroke['align'], weight: number, inside: boolean): number {
  if (align === 'INSIDE') return inside ? weight : 0
  if (align === 'OUTSIDE') return inside ? 0 : weight
  return weight / 2
}

function strokeHits(node: SceneNode, stroke: Stroke, probe: Probe, pad: number): boolean {
  if (probe.strokeAreaWithin) return probe.strokeAreaWithin(pad)
  const align = probe.closed && !probe.centered ? stroke.align : 'CENTER'
  if (probe.strokeOnEdge) {
    const weight = strokeWeightOf(node, stroke)
    return probe.edgeWithin(strokeReachAt(align, weight, probe.inside) + pad)
  }
  // A flat cap ends the stroke at the line's end; round and square caps paint past it.
  const cap = stroke.cap ?? node.strokeCap
  const flatEnds = cap === 'NONE'
  const reaches = (line: LineReach, band: number): boolean => {
    if (flatEnds && line.beyond > 0) {
      // Past a flat end, the distance to the painted band's square end.
      return Math.hypot(line.beyond, Math.max(0, line.across - band)) <= pad
    }
    return line.distance <= band + pad
  }
  if (node.type === 'LINE' && probe.local) {
    // Figma strokes a line a full weight to one side, along the path the renderer draws.
    const weight = strokeWeightOf(node, stroke)
    if (!(weight > 0)) return false
    const { start, end } = lineStrokeEnds(node.width, node.height, weight, cap)
    if (reaches(measureLine([start, end], [true, true], probe.local), weight / 2)) return true
    if (!isArrowCap(cap)) return false
    const still = { x: 0, y: 0 }
    const shaft = {
      vertices: [start, end],
      segments: [{ start: 0, end: 1, tangentStart: still, tangentEnd: still }],
      regions: []
    }
    return hitsArrowHeads(shaft, cap, weight, probe.local, pad)
  }
  const network = node.type === 'VECTOR' ? node.vectorNetwork : null
  if (network && probe.local) {
    const weight = strokeWeightOf(node, stroke)
    if (weight > 0 && hitsArrowHeads(network, cap, weight, probe.local, pad)) return true
  }
  return probe.lines.some((line, index) => {
    const weight = probe.lineWeights?.[index] ?? strokeWeightOf(node, stroke)
    // A side with no weight paints no border.
    if (!(weight > 0)) return false
    return reaches(line, strokeReachAt(align, weight, probe.inside))
  })
}

/**
 * Whether a click at the canvas point lands on the shape, as in Figma: inside the area a
 * clickable fill covers, or on the band a clickable stroke draws, either grown by `pad` canvas
 * units. A shape whose paints show nothing is never hit. Null for a layer without an outline to
 * test, which is hit by its box.
 */
export function hitsShape(
  graph: SceneGraph,
  node: SceneNode,
  px: number,
  py: number,
  pad = 0
): boolean | null {
  const tolerance = pad > 0 ? Math.min(DEFAULT_TOLERANCE, pad / 4) : DEFAULT_TOLERANCE
  const probe = probeNode(graph, node, px, py, tolerance)
  if (!probe) return null
  const fills = node.fills.filter(isHitPaint)
  if (fills.length > 0 && probe.closed && (probe.inside || probe.edgeWithin(pad))) return true
  return node.strokes.some((stroke) => isHitPaint(stroke) && strokeHits(node, stroke, probe, pad))
}
