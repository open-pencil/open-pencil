import { compact } from 'es-toolkit'

import { getWorldMatrix } from '../coordinate'
import type { SceneGraph } from '../graph'
import Matrix from '../matrix'
import type { Vector } from '../primitives'
import type { Fill, SceneNode, Stroke } from '../types'
import { containsByWinding, distanceToLines, distanceToSegment } from './point'
import { shapeOutline, type OutlineArea, type ShapeOutline } from './shapes'

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
    reach = Math.max(reach, stroke.align === 'OUTSIDE' ? weight : weight / 2)
  }
  return reach
}

function localPoint(graph: SceneGraph, node: SceneNode, px: number, py: number): Vector | null {
  const inverse = Matrix.invert(getWorldMatrix(node, graph))
  if (!inverse) return null
  const [x, y] = Matrix.mapPoints(inverse, [px, py])
  return { x, y }
}

interface Probe {
  inside: boolean
  /** Distance to the outline of the filled area, in canvas units. */
  edge: number
  /** Each line a stroke follows, measured from the point in canvas units. */
  lines: LineReach[]
  /** Each line's own stroke weight, where sides differ. */
  lineWeights?: number[]
  /** Whether the layer has an area of its own; strokes on lines are always centred. */
  closed: boolean
  /** Strokes centre on the lines whatever their alignment. */
  centered?: boolean
  /**
   * For a shape combined from operands, whether its outline passes within `radius` of the point;
   * it replaces `edge` and `lines`, which would count operand edges the result does not draw.
   */
  boundaryWithin?: (radius: number) => boolean
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

function probeOutline(outline: ShapeOutline, point: Vector): Probe {
  return {
    inside: outline.areas.some((area) => insideArea(area, point)),
    edge: distanceToLines(
      outline.areas.flatMap((area) => area.contours.map(closedLoop)),
      point
    ),
    lines: outline.lines.map((line, index) => measureLine(line, outline.lineEnds?.[index], point)),
    lineWeights: outline.lineWeights,
    closed: outline.areas.some((area) => area.contours.length > 0),
    centered: outline.strokeCentered
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

/** Points tested along each operand edge near the point for whether the result changes there. */
const EDGE_SAMPLES = 8

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
 * edges hidden inside or outside the result count for nothing, however thin the result is.
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
  /** Whether the result changes across the edge from `a` to `b` at the point `q` on it. */
  const changesAcross = (q: Vector, a: Vector, b: Vector, step: number): boolean => {
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    const nx = -(b.y - a.y) / length
    const ny = (b.x - a.x) / length
    const left = insideAt(q.x + nx * step, q.y + ny * step)
    const right = insideAt(q.x - nx * step, q.y - ny * step)
    return left !== null && right !== null && left !== right
  }
  const boundaryWithin = (radius: number): boolean => {
    const step = Math.max(1e-6, Math.min(tolerance, radius / 4) / 4)
    for (const edge of edges) {
      for (let i = 0; i + 1 < edge.length; i++) {
        const a = edge[i]
        const b = edge[i + 1]
        if (a.x === b.x && a.y === b.y) continue
        if (distanceToSegment(point, a, b) > radius) continue
        // The part of the edge inside the circle, sampled evenly.
        const dx = b.x - a.x
        const dy = b.y - a.y
        const lengthSquared = dx * dx + dy * dy
        const centre = ((px - a.x) * dx + (py - a.y) * dy) / lengthSquared
        const nearest = { x: a.x + dx * centre, y: a.y + dy * centre }
        const half = Math.sqrt(
          Math.max(0, radius * radius - (nearest.x - px) ** 2 - (nearest.y - py) ** 2)
        )
        const from = Math.max(0, centre - half / Math.sqrt(lengthSquared))
        const to = Math.min(1, centre + half / Math.sqrt(lengthSquared))
        for (let k = 0; k <= EDGE_SAMPLES; k++) {
          const t = from + ((to - from) * k) / EDGE_SAMPLES
          if (changesAcross({ x: a.x + dx * t, y: a.y + dy * t }, a, b, step)) return true
        }
      }
    }
    return false
  }
  return { inside, edge: Infinity, lines: [], closed: true, boundaryWithin }
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
  return point ? probeOutline(outline, point) : null
}

/** How far from a line a stroke's band reaches toward the point, beyond which it misses. */
function strokeReachAt(align: Stroke['align'], weight: number, inside: boolean): number {
  if (align === 'INSIDE') return inside ? weight : 0
  if (align === 'OUTSIDE') return inside ? 0 : weight
  return weight / 2
}

function strokeHits(node: SceneNode, stroke: Stroke, probe: Probe, pad: number): boolean {
  const align = probe.closed && !probe.centered ? stroke.align : 'CENTER'
  if (probe.boundaryWithin) {
    const weight = strokeWeightOf(node, stroke)
    return probe.boundaryWithin(strokeReachAt(align, weight, probe.inside) + pad)
  }
  // A flat cap ends the stroke at the line's end; round and square caps paint past it.
  const cap = stroke.cap ?? node.strokeCap
  const flatEnds = cap === 'NONE'
  return probe.lines.some((line, index) => {
    const weight = probe.lineWeights?.[index] ?? strokeWeightOf(node, stroke)
    const reach = strokeReachAt(align, weight, probe.inside) + pad
    if (flatEnds && line.beyond > 0) return line.beyond <= pad && line.across <= reach
    return line.distance <= reach
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
  const nearEdge = probe.boundaryWithin ? probe.boundaryWithin(pad) : probe.edge <= pad
  if (fills.length > 0 && probe.closed && (probe.inside || nearEdge)) return true
  return node.strokes.some((stroke) => isHitPaint(stroke) && strokeHits(node, stroke, probe, pad))
}
