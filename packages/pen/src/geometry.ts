import type { ArcData, VectorNetwork } from '@open-pencil/scene-graph'
import { parseSVGPath } from '@open-pencil/scene-graph/parse-path'
import { maxOf, minOf } from '@open-pencil/std/arrays'

import type { PenNode } from './schema'
import { resolveNumber, type VarContext } from './variables'

const DEGREES = Math.PI / 180

/**
 * An ellipse's arc. pen.dev measures `startAngle` counter-clockwise from the right and sweeps
 * counter-clockwise for a positive `sweepAngle`; the scene graph measures clockwise.
 */
export function ellipseArc(pen: PenNode, ctx: VarContext): ArcData | null {
  if (pen.innerRadius === undefined && pen.startAngle === undefined && pen.sweepAngle === undefined)
    return null
  const start = resolveNumber(pen.startAngle, ctx)
  const sweep = Math.max(-360, Math.min(360, resolveNumber(pen.sweepAngle, ctx, 360)))
  return {
    startingAngle: -start * DEGREES,
    endingAngle: -(start + sweep) * DEGREES,
    innerRadius: Math.max(0, Math.min(1, resolveNumber(pen.innerRadius, ctx)))
  }
}

type ViewBox = [x: number, y: number, width: number, height: number]

/** Where a cubic's coordinate along one axis turns, as curve parameters strictly inside 0 to 1. */
function cubicTurns(p0: number, p1: number, p2: number, p3: number): number[] {
  // The derivative is a quadratic a·t² + b·t + c.
  const a = 3 * (-p0 + 3 * p1 - 3 * p2 + p3)
  const b = 6 * (p0 - 2 * p1 + p2)
  const c = 3 * (p1 - p0)
  let roots: number[] = []
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) >= 1e-12) roots = [-c / b]
  } else if (b * b - 4 * a * c >= 0) {
    const root = Math.sqrt(b * b - 4 * a * c)
    roots = [(-b + root) / (2 * a), (-b - root) / (2 * a)]
  }
  return roots.filter((t) => t > 0 && t < 1)
}

function cubicAt(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
}

/** The geometry's tight bounds: its points and how far its curves reach between them. */
function networkBounds(network: VectorNetwork): ViewBox {
  const xs = network.vertices.map((vertex) => vertex.x)
  const ys = network.vertices.map((vertex) => vertex.y)
  for (const segment of network.segments) {
    const start = network.vertices[segment.start]
    const end = network.vertices[segment.end]
    const x = [
      start.x,
      start.x + segment.tangentStart.x,
      end.x + segment.tangentEnd.x,
      end.x
    ] as const
    const y = [
      start.y,
      start.y + segment.tangentStart.y,
      end.y + segment.tangentEnd.y,
      end.y
    ] as const
    for (const t of [...cubicTurns(...x), ...cubicTurns(...y)]) {
      xs.push(cubicAt(...x, t))
      ys.push(cubicAt(...y, t))
    }
  }
  const [minX, maxX, minY, maxY] = [minOf(xs), maxOf(xs), minOf(ys), maxOf(ys)]
  return [minX, minY, maxX - minX, maxY - minY]
}

/**
 * A path's geometry in its box. `viewBox` is the region of the path's coordinates that fills the
 * box; without one, the geometry's own bounds do. An axis the geometry has no extent on is not
 * scaled, so a straight line keeps its place.
 */
export function pathNetwork(
  pen: PenNode,
  width: number,
  height: number,
  keepEmptyAxes = false
): VectorNetwork | null {
  if (!pen.geometry) return null
  const network = parseSVGPath(pen.geometry, pen.fillRule === 'evenodd' ? 'EVENODD' : 'NONZERO')
  if (network.vertices.length === 0) return network
  const [vx, vy, vw, vh] = pen.viewBox ?? networkBounds(network)
  // Before layout, an axis read at no size keeps the geometry's own extent, so layout can still
  // tell the path is not flat there.
  const sx = vw > 0 && !(keepEmptyAxes && width === 0) ? width / vw : 1
  const sy = vh > 0 && !(keepEmptyAxes && height === 0) ? height / vh : 1
  for (const vertex of network.vertices) {
    vertex.x = (vertex.x - vx) * sx
    vertex.y = (vertex.y - vy) * sy
  }
  for (const segment of network.segments) {
    segment.tangentStart = { x: segment.tangentStart.x * sx, y: segment.tangentStart.y * sy }
    segment.tangentEnd = { x: segment.tangentEnd.x * sx, y: segment.tangentEnd.y * sy }
  }
  return network
}
