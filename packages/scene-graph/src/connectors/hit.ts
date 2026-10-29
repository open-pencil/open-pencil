import { getWorldMatrix } from '../coordinate'
import type { SceneGraph } from '../graph'
import Matrix from '../matrix'
import type { Vector } from '../primitives'
import type { SceneNode } from '../types'
import { isStraight, pointAt, type ConnectorPiece } from './pieces'
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
    const piece: ConnectorPiece = {
      from: network.vertices[segment.start],
      to: network.vertices[segment.end],
      handleFrom: segment.tangentStart,
      handleTo: segment.tangentEnd
    }
    if (isStraight(piece)) return distanceToSegment(point, piece.from, piece.to) <= reach
    let previous = piece.from
    for (let step = 1; step <= CURVE_SAMPLES; step++) {
      const current = pointAt(piece, step / CURVE_SAMPLES)
      if (distanceToSegment(point, previous, current) <= reach) return true
      previous = current
    }
    return false
  })
}
