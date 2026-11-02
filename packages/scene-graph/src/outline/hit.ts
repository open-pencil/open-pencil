import { compact } from 'es-toolkit'

import { getWorldMatrix } from '../coordinate'
import type { SceneGraph } from '../graph'
import Matrix from '../matrix'
import type { Vector } from '../primitives'
import type { Fill, SceneNode, Stroke } from '../types'
import { containsByWinding, distanceToLines } from './point'
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
  /** Distance to each line a stroke follows, in canvas units. */
  lines: number[]
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

function probeOutline(outline: ShapeOutline, point: Vector): Probe {
  return {
    inside: outline.areas.some((area) => insideArea(area, point)),
    edge: distanceToLines(
      outline.areas.flatMap((area) => area.contours.map(closedLoop)),
      point
    ),
    lines: outline.lines.map((line) => distanceToLines([line], point)),
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

/** Directions sampled round a point to find a combined shape's outline near it. */
const BOUNDARY_SAMPLES = 16

/**
 * A boolean operation without saved geometry, combined from its operands as it draws. Its outline
 * is found where the combined result changes near the point, sampled on two rings, so operand
 * edges hidden inside or outside the result count for nothing.
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
  const boundaryWithin = (radius: number): boolean => {
    for (const ring of [radius, radius / 2]) {
      for (let i = 0; i < BOUNDARY_SAMPLES; i++) {
        const angle = (2 * Math.PI * i) / BOUNDARY_SAMPLES
        const sample = insideAt(px + ring * Math.cos(angle), py + ring * Math.sin(angle))
        if (sample !== null && sample !== inside) return true
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
  return probe.lines.some((distance, index) => {
    const weight = probe.lineWeights?.[index] ?? strokeWeightOf(node, stroke)
    return distance <= strokeReachAt(align, weight, probe.inside) + pad
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
