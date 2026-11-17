import { cubicExtrema, cubicPoint } from './cubic'
import { computeBounds, GeometryCommand, readGeometryBlob } from './geometry'
import type { Rect, Vector } from './primitives'
import type { GeometryPath, VectorNetwork } from './types'

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

type Axis = { min: number; max: number }

function includeFinite(axis: Axis, value: number): void {
  if (value < axis.min) axis.min = value
  if (value > axis.max) axis.max = value
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

function includeCommand(
  xAxis: Axis,
  yAxis: Axis,
  current: Vector | null,
  command: number,
  coords: readonly number[]
): Vector | null {
  if (command === GeometryCommand.CLOSE) return current
  const end = { x: coords[coords.length - 2], y: coords[coords.length - 1] }
  if (command === GeometryCommand.MOVE || command === GeometryCommand.LINE || !current) {
    includeFinite(xAxis, end.x)
    includeFinite(yAxis, end.y)
    return end
  }
  if (command === GeometryCommand.QUAD) {
    includeQuadratic(xAxis, yAxis, current, { x: coords[0], y: coords[1] }, end)
  } else if (command === GeometryCommand.CUBIC) {
    includeCubic(
      xAxis,
      yAxis,
      current,
      { x: coords[0], y: coords[1] },
      { x: coords[2], y: coords[3] },
      end
    )
  }
  return end
}

/**
 * The width and height of saved path geometry, on the curve rather than its handles. An empty
 * path has no length. A non-finite coordinate stays out of its axis.
 */
export function geometryAxisLengths(
  paths: readonly GeometryPath[]
): Pick<Rect, 'width' | 'height'> | null {
  const xAxis: Axis = { min: Infinity, max: -Infinity }
  const yAxis: Axis = { min: Infinity, max: -Infinity }
  for (const path of paths) {
    let current: Vector | null = null
    readGeometryBlob(path.commandsBlob, (command, coords) => {
      current = includeCommand(xAxis, yAxis, current, command, coords)
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
