import type { Vector } from '../primitives'
import type { ConnectorControlPoint } from '../types'
import { ELBOW_STUB, simplify } from './elbow'
import { along, EPSILON, pointAt, straightPieces, type ConnectorPiece } from './pieces'
import { attachment, OUTWARD, type ConnectorRouteEnd, type ConnectorSide } from './sides'

/**
 * Elbows and curves dragged into place, as FigJam keeps them
 * (`packages/scene-graph/tests/connectors/figma-control-routes.json`): an elbow runs along each
 * dragged segment's line in turn, and a curve takes its two control points as they were left.
 */

type Direction = ConnectorControlPoint['direction']

/** A route end's side, with the line it leaves or arrives along and where it attaches. */
interface RouteSide {
  at: Vector
  direction: Direction
  /** Where a segment joining a parallel control line runs: a stub's length out of the layer. */
  joint: Vector
}

function directionOf(side: ConnectorSide): Direction {
  return side === 'LEFT' || side === 'RIGHT' ? 'HORIZONTAL' : 'VERTICAL'
}

function routeSide(end: ConnectorRouteEnd, side: ConnectorSide): RouteSide {
  const at = attachment(end, side)
  return {
    at,
    direction: directionOf(side),
    joint: end.box ? along(at, OUTWARD[side], ELBOW_STUB) : at
  }
}

/** The coordinate a control line fixes: x for a vertical segment, y for a horizontal one. */
function lineOf(point: ConnectorControlPoint): number {
  return point.direction === 'VERTICAL' ? point.position.x : point.position.y
}

/** Where a run along `direction` through `from` meets the perpendicular line `to`. */
function meet(from: Vector, direction: Direction, to: number): Vector {
  return direction === 'HORIZONTAL' ? { x: to, y: from.y } : { x: from.x, y: to }
}

/**
 * Moves an end along its segment by its gap, towards the next point, unless the segment is no
 * longer than the gap.
 */
function inset(point: Vector, toward: Vector, gap: number): Vector {
  const length = Math.hypot(toward.x - point.x, toward.y - point.y)
  return length <= gap ? point : towards(point, toward, gap)
}

/**
 * An elbow through its control lines: from the start's side to each line in turn, then to the end's
 * side. A line parallel to the run before it is reached by a segment across, at the stub of the
 * end it follows or leads to, or midway between two control lines. Points in line merge, so ends
 * that face each other in line draw straight. Each end then stops short by its gap along its own
 * segment, which may point back into its layer.
 */
export function controlledElbowRoute(
  start: ConnectorRouteEnd,
  end: ConnectorRouteEnd,
  [startSide, endSide]: [ConnectorSide, ConnectorSide],
  [startGap, endGap]: [number, number],
  controls: ConnectorControlPoint[]
): ConnectorPiece[] {
  const from = routeSide(start, startSide)
  const to = routeSide(end, endSide)
  const points: Vector[] = [from.at]
  let at = from.at
  let direction = from.direction
  let joint = from.joint
  const turnOnto = (line: number, lineDirection: Direction) => {
    if (lineDirection === direction) {
      // A parallel line is reached by a segment across it.
      const across = meet(at, direction, direction === 'HORIZONTAL' ? joint.x : joint.y)
      points.push(across)
      at = across
      direction = direction === 'HORIZONTAL' ? 'VERTICAL' : 'HORIZONTAL'
    }
    at = meet(at, direction, line)
    points.push(at)
    direction = lineDirection
  }
  controls.forEach((control, index) => {
    const next = controls.at(index + 1)
    turnOnto(lineOf(control), control.direction)
    // Between two parallel control lines, the segment across runs midway.
    joint =
      next && next.direction === control.direction
        ? {
            x: (control.position.x + next.position.x) / 2,
            y: (control.position.y + next.position.y) / 2
          }
        : to.joint
  })
  // The end's own line, which its last segment arrives along.
  turnOnto(to.direction === 'HORIZONTAL' ? to.at.y : to.at.x, to.direction)
  points.push(to.at)
  const route = simplify(points)
  if (route.length < 2) return straightPieces([from.at, from.at])
  route[0] = inset(route[0], route[1], startGap)
  route[route.length - 1] = inset(route.at(-1) ?? to.at, route.at(-2) ?? from.at, endGap)
  return straightPieces(route)
}

/**
 * A curve through the control points it was dragged to: each end leaves its side's midpoint, less
 * its gap, towards its own control point.
 */
export function controlledCurveRoute(
  start: ConnectorRouteEnd,
  end: ConnectorRouteEnd,
  [startSide, endSide]: [ConnectorSide, ConnectorSide],
  [startGap, endGap]: [number, number],
  [startHandle, endHandle]: [Vector, Vector]
): ConnectorPiece[] {
  const from = towards(attachment(start, startSide), startHandle, startGap)
  const to = towards(attachment(end, endSide), endHandle, endGap)
  return [
    {
      from,
      to,
      handleFrom: { x: startHandle.x - from.x, y: startHandle.y - from.y },
      handleTo: { x: endHandle.x - to.x, y: endHandle.y - to.y }
    }
  ]
}

/** `point` moved `distance` towards `toward`. */
function towards(point: Vector, toward: Vector, distance: number): Vector {
  const length = Math.hypot(toward.x - point.x, toward.y - point.y)
  if (length < EPSILON) return point
  return along(
    point,
    { x: (toward.x - point.x) / length, y: (toward.y - point.y) / length },
    distance
  )
}

/**
 * The control points an elbow keeps for its route as drawn: one for each segment between its
 * first and its last, at the segment's midpoint, as FigJam records them after an edit.
 */
export function elbowControlPoints(pieces: ConnectorPiece[]): ConnectorControlPoint[] {
  return pieces.slice(1, -1).flatMap(({ from, to }) => {
    const vertical = Math.abs(from.x - to.x) < EPSILON
    if (vertical && Math.abs(from.y - to.y) < EPSILON) return []
    return [
      {
        position: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
        direction: vertical ? 'VERTICAL' : 'HORIZONTAL'
      }
    ]
  })
}

/**
 * Where an elbow's ends turn when its first or last segment is dragged: a stub's length out of
 * each layer, or at a free end's point.
 */
export function elbowJoints(
  start: ConnectorRouteEnd,
  end: ConnectorRouteEnd,
  [startSide, endSide]: [ConnectorSide, ConnectorSide]
): [Vector, Vector] {
  return [routeSide(start, startSide).joint, routeSide(end, endSide).joint]
}

/**
 * The control points an elbow takes when its segment `index` is dragged across to `offset`: an x
 * for a vertical segment, a y for a horizontal one. A segment between others moves alone. Its
 * first or last segment turns at its end's joint, by a new segment across, and then runs at
 * `offset`, as FigJam splits one.
 */
export function dragElbowSegment(
  pieces: ConnectorPiece[],
  [startJoint, endJoint]: [Vector, Vector],
  index: number,
  offset: number
): ConnectorControlPoint[] {
  const piece = pieces.at(index)
  if (!piece || index < 0) return elbowControlPoints(pieces)
  const direction: Direction =
    Math.abs(piece.from.x - piece.to.x) < EPSILON ? 'VERTICAL' : 'HORIZONTAL'
  const across: Direction = direction === 'VERTICAL' ? 'HORIZONTAL' : 'VERTICAL'
  const x = (piece.from.x + piece.to.x) / 2
  const y = (piece.from.y + piece.to.y) / 2
  const moved: ConnectorControlPoint = {
    position: direction === 'VERTICAL' ? { x: offset, y } : { x, y: offset },
    direction
  }
  const before =
    index === 0
      ? [{ position: startJoint, direction: across }]
      : elbowControlPoints(pieces.slice(0, index + 1))
  const after =
    index === pieces.length - 1
      ? [{ position: endJoint, direction: across }]
      : elbowControlPoints(pieces.slice(index))
  return [...before, moved, ...after]
}

/** A curve's control points as drawn: where its handles reach. */
export function curveControlPoints(piece: ConnectorPiece): [Vector, Vector] {
  return [
    { x: piece.from.x + piece.handleFrom.x, y: piece.from.y + piece.handleFrom.y },
    { x: piece.to.x + piece.handleTo.x, y: piece.to.y + piece.handleTo.y }
  ]
}

/** The point midway along a curve, where its handle sits. */
export function curveMidpoint(piece: ConnectorPiece): Vector {
  return pointAt(piece, 0.5)
}

/**
 * The control points a curve takes when the point midway along it is dragged by `delta`: both
 * move by 4/3 of it, which moves the midpoint by exactly `delta`.
 */
export function dragCurve(handles: [Vector, Vector], delta: Vector): [Vector, Vector] {
  const shift = (point: Vector) => ({
    x: point.x + (delta.x * 4) / 3,
    y: point.y + (delta.y * 4) / 3
  })
  return [shift(handles[0]), shift(handles[1])]
}
