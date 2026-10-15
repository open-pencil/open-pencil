import { getWorldMatrix } from '../coordinate'
import type { SceneGraph } from '../index'
import Matrix from '../matrix'
import type { Vector } from '../primitives'
import type { SceneNode } from '../types'
import { connectorSublayers } from './sublayers'

/** How far from a line, beyond half its stroke, a point still lands on it, in canvas units. */
const CONNECTOR_HIT_SLOP = 4
/** Points sampled along a curved segment to measure distance to it. */
const CURVE_SAMPLES = 24

function distanceToSegment(p: Vector, a: Vector, b: Vector): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function cubicPoint(a: Vector, c1: Vector, c2: Vector, b: Vector, t: number): Vector {
  const u = 1 - t
  return {
    x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
    y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y
  }
}

/**
 * Whether a canvas point lands on a connector's line: within half its stroke and a few units of
 * slop, plus `pad`. A connector is picked by its line, not by the box around its route.
 */
export function hitsConnectorLine(
  graph: SceneGraph,
  connector: SceneNode,
  px: number,
  py: number,
  pad = 0
): boolean {
  const line = connectorSublayers(graph, connector)?.line
  const network = line?.vectorNetwork
  if (!line || !network) return false
  const inverse = Matrix.invert(getWorldMatrix(line, graph))
  if (!inverse) return false
  const [x, y] = Matrix.mapPoints(inverse, [px, py])
  const point = { x, y }
  const reach = (line.strokes[0]?.weight ?? line.strokeWeight) / 2 + CONNECTOR_HIT_SLOP + pad
  return network.segments.some((segment) => {
    const a = network.vertices[segment.start]
    const b = network.vertices[segment.end]
    const { tangentStart: ts, tangentEnd: te } = segment
    if (ts.x === 0 && ts.y === 0 && te.x === 0 && te.y === 0) {
      return distanceToSegment(point, a, b) <= reach
    }
    const c1 = { x: a.x + ts.x, y: a.y + ts.y }
    const c2 = { x: b.x + te.x, y: b.y + te.y }
    let previous = a
    for (let step = 1; step <= CURVE_SAMPLES; step++) {
      const current = cubicPoint(a, c1, c2, b, step / CURVE_SAMPLES)
      if (distanceToSegment(point, previous, current) <= reach) return true
      previous = current
    }
    return false
  })
}
