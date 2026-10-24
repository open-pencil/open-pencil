import type { Rect, Vector } from '../primitives'
import type { ConnectorControlPoint, ConnectorLineType } from '../types'
import { controlledCurveRoute, controlledElbowRoute } from './controls'
import { elbowRoute } from './elbow'
import { connectorEndGap } from './gaps'
import { along, EPSILON, exitPoint, straightPieces, ZERO, type ConnectorPiece } from './pieces'
import {
  attachment,
  connectorSides,
  opposite,
  OUTWARD,
  sideMidpoint,
  sidesFor,
  type ConnectorRouteEnd,
  type ConnectorSide
} from './sides'

/**
 * Connector routing as FigJam routes, checked against routes Figma derived
 * (`packages/scene-graph/tests/connectors/figma-routes.json`).
 */

/** Curve handles as a share of the distance between the two edge points. */
const CURVE_HANDLE_RATIO = 0.42667

/** Whether two boxes share more than a corner: they overlap, or meet along an edge. */
function touches(a: Rect, b: Rect): boolean {
  const meetX = a.x <= b.x + b.width && b.x <= a.x + a.width
  const meetY = a.y <= b.y + b.height && b.y <= a.y + a.height
  const overlapX = a.x < b.x + b.width && b.x < a.x + a.width
  const overlapY = a.y < b.y + b.height && b.y < a.y + a.height
  return (overlapX && meetY) || (meetX && overlapY)
}

function unit(from: Vector, to: Vector): Vector {
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  return length === 0 ? ZERO : { x: (to.x - from.x) / length, y: (to.y - from.y) / length }
}

/** Where a straight connector's end sits: its side midpoint, or the centre of its layer. */
function straightAnchor(end: ConnectorRouteEnd): Vector {
  const { box } = end
  if (!box) return end.point
  const sides = sidesFor(end.magnet)
  if (sides.length === 1) return sideMidpoint(box, sides[0])
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** A straight connector: centre to centre, cut where it leaves each layer, less the gaps. */
function straightRoute(
  start: ConnectorRouteEnd,
  end: ConnectorRouteEnd,
  [startGap, endGap]: [number, number]
): ConnectorPiece[] {
  const from = straightAnchor(start)
  const to = straightAnchor(end)
  const exit = start.box ? exitPoint(start.box, from, to) : from
  const entry = end.box ? exitPoint(end.box, to, from) : to
  const direction = unit(exit, entry)
  return straightPieces([along(exit, direction, startGap), along(entry, direction, -endGap)])
}

/**
 * A curved connector: one cubic between the elbow's ends, its handles along the sides it leaves
 * and enters by. Each handle is a fixed share of the distance between the edge points, less the
 * end's gap; ends that face each other in line draw straight.
 */
function curvedRoute(
  start: ConnectorRouteEnd,
  end: ConnectorRouteEnd,
  [startSide, endSide]: [ConnectorSide, ConnectorSide],
  [startGap, endGap]: [number, number]
): ConnectorPiece[] {
  const edgeFrom = attachment(start, startSide)
  const edgeTo = attachment(end, endSide)
  const from = along(edgeFrom, OUTWARD[startSide], startGap)
  const to = along(edgeTo, OUTWARD[endSide], endGap)
  const vertical = startSide === 'TOP' || startSide === 'BOTTOM'
  const offset = vertical ? from.x - to.x : from.y - to.y
  if (Math.abs(offset) < EPSILON && endSide === opposite(startSide)) {
    return straightPieces([from, to])
  }
  const handle = CURVE_HANDLE_RATIO * Math.hypot(edgeTo.x - edgeFrom.x, edgeTo.y - edgeFrom.y)
  return [
    {
      from,
      to,
      handleFrom: along(ZERO, OUTWARD[startSide], Math.max(0, handle - startGap)),
      handleTo: along(ZERO, OUTWARD[endSide], Math.max(0, handle - endGap))
    }
  ]
}

/**
 * Whether an end stops short of where it attaches by its cap's gap: every end attached by a
 * magnet does, including one FigJam pins to a point of a section (`ABSOLUTE`); a free end, or a
 * point a script sets (`NONE`), is reached exactly.
 */
function gapped(end: ConnectorRouteEnd): boolean {
  return end.magnet !== 'NONE'
}

/** Where a connector's line was dragged to, in the connector's parent's axes. */
export interface ConnectorRouteControls {
  /** An elbow's dragged segments, in order. */
  points: ConnectorControlPoint[]
  /** A curve's two control points. */
  curve: [Vector, Vector] | null
}

/**
 * The pieces of a connector's line between its two ends, in the connector's parent's axes. Ends
 * attached by a magnet stop short by their caps' gaps; free ends sit on their points. Layers that
 * touch or overlap leave an elbow or a curve nothing to route but the start, as in Figma. An elbow
 * runs along the segments it was dragged to and a curve bends to its dragged control points,
 * leaving their ends by the sides they would take anyway.
 */
export function routeConnector(
  lineType: ConnectorLineType,
  start: ConnectorRouteEnd,
  end: ConnectorRouteEnd,
  strokeWeight: number,
  controls: ConnectorRouteControls = { points: [], curve: null }
): ConnectorPiece[] {
  const gaps: [number, number] = [
    gapped(start) ? connectorEndGap(start, strokeWeight, 'start') : 0,
    gapped(end) ? connectorEndGap(end, strokeWeight, 'end') : 0
  ]
  if (lineType === 'STRAIGHT') return straightRoute(start, end, gaps)
  const [startSide, endSide] = connectorSides(start, end)
  if (start.box && end.box && touches(start.box, end.box)) {
    const at = sideMidpoint(start.box, startSide)
    return [{ from: at, to: at, handleFrom: ZERO, handleTo: ZERO }]
  }
  if (lineType === 'CURVED' && controls.curve) {
    return controlledCurveRoute(start, end, [startSide, endSide], gaps, controls.curve)
  }
  if (lineType === 'CURVED') {
    // A curve to a free point arrives facing the way it left, where an elbow arrives along the
    // longer axis.
    const curveEndSide = end.box || !start.box ? endSide : opposite(startSide)
    return curvedRoute(start, end, [startSide, curveEndSide], gaps)
  }
  if (controls.points.length > 0) {
    return controlledElbowRoute(start, end, [startSide, endSide], gaps, controls.points)
  }
  return elbowRoute(start, end, [startSide, endSide], gaps) ?? []
}
