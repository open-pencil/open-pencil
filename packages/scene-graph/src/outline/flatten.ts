import { cubicPoint } from '../cubic'
import { GeometryCommand, readGeometryBlob } from '../geometry'
import type { PolygonOutlineCommand } from '../polygon'
import type { Vector } from '../primitives'
import type { VectorNetwork } from '../types'

/**
 * Keeps a huge curve at a tiny tolerance from flattening into an unbounded number of points, while
 * leaving room for the largest arcs at the maximum zoom: a 100,000-unit circle at 25,600% needs
 * about 12,000 steps to stay within the click pad.
 */
const MAX_CURVE_STEPS = 65_536

/**
 * Steps that keep a cubic's polyline within `tolerance` of it: equal steps in t stray at most
 * M / (8n²) from a curve whose second derivative is at most M, and for a cubic
 * M ≤ 6 · max(|p0 − 2p1 + p2|, |p1 − 2p2 + p3|).
 */
function curveSteps(p0: Vector, p1: Vector, p2: Vector, p3: Vector, tolerance: number): number {
  const bend = Math.max(
    Math.hypot(p0.x - 2 * p1.x + p2.x, p0.y - 2 * p1.y + p2.y),
    Math.hypot(p1.x - 2 * p2.x + p3.x, p1.y - 2 * p2.y + p3.y)
  )
  const steps = Math.ceil(Math.sqrt((6 * bend) / (8 * tolerance)))
  return Math.min(MAX_CURVE_STEPS, Math.max(1, steps))
}

/** Points along a cubic after its start, within `tolerance` of it, ending on `p3`. */
function cubicPoints(p0: Vector, p1: Vector, p2: Vector, p3: Vector, tolerance: number): Vector[] {
  const steps = curveSteps(p0, p1, p2, p3, tolerance)
  const points: Vector[] = []
  for (let step = 1; step <= steps; step++) points.push(cubicPoint(p0, p1, p2, p3, step / steps))
  return points
}

/** Points along a vector network segment, from its start to its end, in network coordinates. */
export function segmentPoints(
  network: VectorNetwork,
  index: number,
  tolerance: number
): Vector[] | null {
  // `at` counts a negative index from the end and truncates a fraction; a loop naming either
  // refers to no segment.
  if (!Number.isInteger(index) || index < 0) return null
  const segment = network.segments.at(index)
  if (!segment || segment.start < 0 || segment.end < 0) return null
  const p0 = network.vertices.at(segment.start)
  const p3 = network.vertices.at(segment.end)
  if (!p0 || !p3) return null
  const { tangentStart: a, tangentEnd: b } = segment
  if (a.x === 0 && a.y === 0 && b.x === 0 && b.y === 0) return [p0, p3]
  const p1 = { x: p0.x + a.x, y: p0.y + a.y }
  const p2 = { x: p3.x + b.x, y: p3.y + b.y }
  return [p0, ...cubicPoints(p0, p1, p2, p3, tolerance)]
}

/**
 * A loop's points in the order it is walked. Segments in a loop can be stored either way round,
 * so each is followed from the vertex the previous one ended on.
 */
export function loopPoints(network: VectorNetwork, loop: number[], tolerance: number): Vector[] {
  const { segments } = network
  const first = segments.at(loop[0] ?? -1)
  const second = segments.at(loop[1] ?? -1)
  if (!first) return []
  // Walk the first segment toward the vertex it shares with the next one.
  const firstForward = !second || first.end === second.start || first.end === second.end
  let current = firstForward ? first.start : first.end
  const points: Vector[] = []
  for (const index of loop) {
    const segment = segments.at(index)
    const along = segmentPoints(network, index, tolerance)
    if (!segment || !along) continue
    const forward = segment.start === current
    points.push(...(forward ? along : along.toReversed()))
    current = forward ? segment.end : segment.start
  }
  return points
}

/**
 * The network's segments joined into runs, a run continuing while each segment starts where the
 * last ended, as a path draws them one after another.
 */
export function segmentRuns(network: VectorNetwork, tolerance: number): Vector[][] {
  const runs: Vector[][] = []
  let run: Vector[] = []
  let end = -1
  for (const [index, segment] of network.segments.entries()) {
    const along = segmentPoints(network, index, tolerance)
    if (!along) continue
    if (segment.start === end && run.length > 0) run.push(...along.slice(1))
    else {
      if (run.length > 1) runs.push(run)
      run = along
    }
    end = segment.end
  }
  if (run.length > 1) runs.push(run)
  return runs
}

/** The contours of a Figma geometry blob, curves flattened to within `tolerance`. */
export function blobContours(blob: Uint8Array, tolerance: number): Vector[][] {
  const contours: Vector[][] = []
  let contour: Vector[] = []
  const flush = () => {
    if (contour.length > 1) contours.push(contour)
    contour = []
  }
  readGeometryBlob(blob, (command, c) => {
    if (command === GeometryCommand.CLOSE) return flush()
    if (command === GeometryCommand.MOVE) {
      flush()
      contour.push({ x: c[0], y: c[1] })
      return
    }
    const end = { x: c[c.length - 2], y: c[c.length - 1] }
    const last = contour.at(-1)
    if (!last || command === GeometryCommand.LINE) {
      contour.push(end)
    } else if (command === GeometryCommand.QUAD) {
      // A quadratic as the cubic with the same curve.
      const q = { x: c[0], y: c[1] }
      const c1 = { x: last.x + (2 / 3) * (q.x - last.x), y: last.y + (2 / 3) * (q.y - last.y) }
      const c2 = { x: end.x + (2 / 3) * (q.x - end.x), y: end.y + (2 / 3) * (q.y - end.y) }
      contour.push(...cubicPoints(last, c1, c2, end, tolerance))
    } else {
      contour.push(...cubicPoints(last, { x: c[0], y: c[1] }, { x: c[2], y: c[3] }, end, tolerance))
    }
  })
  flush()
  return contours
}

/** The contours of polygon outline commands, curves flattened to within `tolerance`. */
export function commandContours(
  commands: readonly PolygonOutlineCommand[],
  tolerance: number
): Vector[][] {
  const contours: Vector[][] = []
  let contour: Vector[] = []
  for (const command of commands) {
    if (command.type === 'Z' || command.type === 'M') {
      if (contour.length > 1) contours.push(contour)
      contour = command.type === 'M' ? [{ x: command.x, y: command.y }] : []
      continue
    }
    const last = contour.at(-1) ?? { x: 0, y: 0 }
    if (command.type !== 'C') contour.push({ x: command.x, y: command.y })
    else
      contour.push(
        ...cubicPoints(
          last,
          { x: command.x1, y: command.y1 },
          { x: command.x2, y: command.y2 },
          { x: command.x, y: command.y },
          tolerance
        )
      )
  }
  if (contour.length > 1) contours.push(contour)
  return contours
}

/** Points around an ellipse arc from `start` to `end` radians, at most `tolerance` off it. */
export function arcPoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  start: number,
  end: number,
  tolerance: number
): Vector[] {
  const radius = Math.max(rx, ry)
  // A chord over angle θ strays r(1 − cos(θ/2)) from the arc.
  const step =
    radius > tolerance ? 2 * Math.acos(Math.max(-1, 1 - tolerance / radius)) : Math.PI / 2
  const steps = Math.min(
    MAX_CURVE_STEPS,
    Math.max(1, Math.ceil(Math.abs(end - start) / Math.max(step, 1e-3)))
  )
  const points: Vector[] = []
  for (let i = 0; i <= steps; i++) {
    const angle = start + ((end - start) * i) / steps
    points.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) })
  }
  return points
}
