import { cubicExtrema, cubicPoint } from './cubic'
import { GeometryCommand, readGeometryBlob } from './geometry'
import type { Rect, Vector } from './primitives'
import type { GeometryPath, VectorNetwork } from './types'

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

type Axis = { min: number; max: number }

/** A comparison with NaN is false, so that coordinate stays out of its axis. */
function includeFinite(axis: Axis, value: number): void {
  if (value < axis.min) axis.min = value
  if (value > axis.max) axis.max = value
}

function freshAxis(): Axis {
  return { min: Infinity, max: -Infinity }
}

/** Each axis of a network, with a non-finite coordinate left out of its own axis. */
function networkAxes(network: VectorNetwork): { x: Axis; y: Axis } {
  const x = freshAxis()
  const y = freshAxis()
  eachNetworkPoint(network, (point) => {
    includeFinite(x, point.x)
    includeFinite(y, point.y)
  })
  return { x, y }
}

/**
 * The tight box of a vector network, including where its curves peak. A non-finite coordinate is
 * left out of its axis, so one of them does not erase a finite side or the coordinates on it.
 */
export function vectorNetworkBounds(network: VectorNetwork): Rect {
  if (network.vertices.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  const { x, y } = networkAxes(network)
  return { x: x.min, y: y.min, width: x.max - x.min, height: y.max - y.min }
}

/**
 * The width and height of a network, measured apart. A NaN coordinate is left out of its axis.
 * An empty or infinite axis is not a finite length, and it does not erase the other axis.
 */
export function vectorNetworkAxisLengths(network: VectorNetwork): Pick<Rect, 'width' | 'height'> {
  const { x, y } = networkAxes(network)
  return { width: x.max - x.min, height: y.max - y.min }
}

/** Where a cubic is level, not its handles. A handle can sit outside the curve. */
function includeCubic(
  xAxis: Axis,
  yAxis: Axis,
  p0: Vector,
  p1: Vector,
  p2: Vector,
  p3: Vector
): void {
  for (const t of cubicExtrema(p0.x, p1.x, p2.x, p3.x)) {
    includeFinite(xAxis, cubicPoint(p0, p1, p2, p3, t).x)
  }
  for (const t of cubicExtrema(p0.y, p1.y, p2.y, p3.y)) {
    includeFinite(yAxis, cubicPoint(p0, p1, p2, p3, t).y)
  }
  includeFinite(xAxis, p3.x)
  includeFinite(yAxis, p3.y)
}

function includeQuadratic(
  xAxis: Axis,
  yAxis: Axis,
  start: Vector,
  control: Vector,
  end: Vector
): void {
  const c1 = {
    x: start.x + (2 / 3) * (control.x - start.x),
    y: start.y + (2 / 3) * (control.y - start.y)
  }
  const c2 = {
    x: end.x + (2 / 3) * (control.x - end.x),
    y: end.y + (2 / 3) * (control.y - end.y)
  }
  includeCubic(xAxis, yAxis, start, c1, c2, end)
}

/** Where the pen is, and the point a close returns to: the start of the open contour. */
interface PathPen {
  current: Vector | null
  contour: Vector | null
}

function includeCommand(
  xAxis: Axis,
  yAxis: Axis,
  pen: PathPen,
  command: number,
  coords: readonly number[]
): void {
  // A close returns the pen to the contour start, as a path builder does, so the next curve
  // leaves from there rather than from the point before the close.
  if (command === GeometryCommand.CLOSE) {
    pen.current = pen.contour
    return
  }
  const end = { x: coords[coords.length - 2], y: coords[coords.length - 1] }
  const start = pen.current
  if (command === GeometryCommand.MOVE || command === GeometryCommand.LINE || !start) {
    includeFinite(xAxis, end.x)
    includeFinite(yAxis, end.y)
  } else if (command === GeometryCommand.QUAD) {
    includeQuadratic(xAxis, yAxis, start, { x: coords[0], y: coords[1] }, end)
  } else if (command === GeometryCommand.CUBIC) {
    includeCubic(
      xAxis,
      yAxis,
      start,
      { x: coords[0], y: coords[1] },
      { x: coords[2], y: coords[3] },
      end
    )
  }
  if (command === GeometryCommand.MOVE) pen.contour = end
  pen.current = end
}

/**
 * The width and height of saved path geometry, on the curve rather than its handles. An empty
 * path has no length. A non-finite coordinate stays out of its axis.
 */
export function geometryAxisLengths(
  paths: readonly GeometryPath[]
): Pick<Rect, 'width' | 'height'> | null {
  const xAxis = freshAxis()
  const yAxis = freshAxis()
  for (const path of paths) {
    const pen: PathPen = { current: null, contour: null }
    readGeometryBlob(path.commandsBlob, (command, coords) => {
      includeCommand(xAxis, yAxis, pen, command, coords)
    })
  }
  const width = xAxis.max - xAxis.min
  const height = yAxis.max - yAxis.min
  if (!Number.isFinite(width) && !Number.isFinite(height)) return null
  return {
    width: Number.isFinite(width) ? width : 0,
    height: Number.isFinite(height) ? height : 0
  }
}
