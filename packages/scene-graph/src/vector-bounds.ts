import { cubicExtrema, cubicPoint } from './cubic'
import { computeBounds } from './geometry'
import type { Rect, Vector } from './primitives'
import type { VectorNetwork } from './types'

function pointBounds(point: Vector): Rect {
  return { x: point.x, y: point.y, width: 0, height: 0 }
}

function eachNetworkPoint(network: VectorNetwork, visit: (point: Vector) => void): void {
  for (const vertex of network.vertices) visit(vertex)
  for (const segment of network.segments) {
    if (!Number.isInteger(segment.start) || segment.start < 0) continue
    if (!Number.isInteger(segment.end) || segment.end < 0) continue
    const start = network.vertices.at(segment.start)
    const end = network.vertices.at(segment.end)
    if (!start || !end) continue
    const p1 = { x: start.x + segment.tangentStart.x, y: start.y + segment.tangentStart.y }
    const p2 = { x: end.x + segment.tangentEnd.x, y: end.y + segment.tangentEnd.y }
    for (const t of cubicExtrema(start.x, p1.x, p2.x, end.x)) {
      visit(cubicPoint(start, p1, p2, end, t))
    }
    for (const t of cubicExtrema(start.y, p1.y, p2.y, end.y)) {
      visit(cubicPoint(start, p1, p2, end, t))
    }
  }
}

/**
 * The tight box of a vector network, including where its curves peak. A zero side scales from
 * this, which is the size the path was drawn at.
 */
export function vectorNetworkBounds(network: VectorNetwork): Rect {
  if (network.vertices.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  const points: Rect[] = []
  eachNetworkPoint(network, (point) => points.push(pointBounds(point)))
  return computeBounds(points)
}

/**
 * The width and height of a network, measured apart. A NaN coordinate is left out of its axis.
 * An empty or infinite axis is not a finite length, and it does not erase the other axis.
 */
export function vectorNetworkAxisLengths(network: VectorNetwork): Pick<Rect, 'width' | 'height'> {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  eachNetworkPoint(network, ({ x, y }) => {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  })
  return { width: maxX - minX, height: maxY - minY }
}
