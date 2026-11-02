import type { Rect, Vector } from '../primitives'
import type { ConnectorMagnet, StrokeCap } from '../types'
import { EPSILON } from './pieces'

export type ConnectorSide = 'TOP' | 'RIGHT' | 'BOTTOM' | 'LEFT'

/** Ties between sides go to the first in this order, start side before end side. */
export const SIDES: readonly ConnectorSide[] = ['TOP', 'RIGHT', 'BOTTOM', 'LEFT']
export const OUTWARD: Record<ConnectorSide, Vector> = {
  TOP: { x: 0, y: -1 },
  RIGHT: { x: 1, y: 0 },
  BOTTOM: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 }
}

/** One end of a connector as the router sees it: the box it follows, or a free point. */
export interface ConnectorRouteEnd {
  /** The bound layer's box in the connector's parent's axes; null for an end at a point. */
  box: Rect | null
  /** Where an end at a point sits, in the connector's parent's axes. */
  point: Vector
  magnet: ConnectorMagnet
  cap: StrokeCap
  /** How far the layer's outline reaches past its box: half a FigJam shape's stroke. */
  outline: number
}

export function sideMidpoint(box: Rect, side: ConnectorSide): Vector {
  const { x, y } = OUTWARD[side]
  return { x: box.x + (box.width * (x + 1)) / 2, y: box.y + (box.height * (y + 1)) / 2 }
}

export function opposite(side: ConnectorSide): ConnectorSide {
  return SIDES[(SIDES.indexOf(side) + 2) % 4]
}

export function sidesFor(magnet: ConnectorMagnet): readonly ConnectorSide[] {
  if (magnet === 'AUTO_HORIZONTAL') return ['RIGHT', 'LEFT']
  if (magnet === 'TOP' || magnet === 'RIGHT' || magnet === 'BOTTOM' || magnet === 'LEFT') {
    return [magnet]
  }
  // No file seen so far uses `EDGE`; until one shows what it means, its ends leave by the nearest
  // side.
  return SIDES
}

/** Where an end attaches: on its side, or at its free point. */
export function attachment(end: ConnectorRouteEnd, side: ConnectorSide): Vector {
  return end.box ? sideMidpoint(end.box, side) : end.point
}

/** The side a free point faces: the one its line reaches it through along the longer axis. */
function freeSide(point: Vector, from: Vector): ConnectorSide {
  const dx = point.x - from.x
  const dy = point.y - from.y
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'LEFT' : 'RIGHT'
  return dy >= 0 ? 'TOP' : 'BOTTOM'
}

function anchorsOf(end: ConnectorRouteEnd): { side: ConnectorSide; at: Vector }[] {
  const { box } = end
  if (!box) return SIDES.map((side) => ({ side, at: end.point }))
  return sidesFor(end.magnet).map((side) => ({ side, at: sideMidpoint(box, side) }))
}

/**
 * The sides a connector leaves and enters by: of the side midpoints its magnets allow, the pair
 * closest together. A free end faces its line along the longer axis.
 */
export function connectorSides(
  start: ConnectorRouteEnd,
  end: ConnectorRouteEnd
): [ConnectorSide, ConnectorSide] {
  if (!start.box && !end.box) {
    const side = freeSide(end.point, start.point)
    return [opposite(side), side]
  }
  let best = { distance: Infinity, sides: ['TOP', 'TOP'] as [ConnectorSide, ConnectorSide] }
  let from = start.point
  let to = end.point
  for (const a of anchorsOf(start)) {
    for (const b of anchorsOf(end)) {
      const distance = Math.hypot(b.at.x - a.at.x, b.at.y - a.at.y)
      if (distance >= best.distance - EPSILON) continue
      best = { distance, sides: [a.side, b.side] }
      from = a.at
      to = b.at
    }
  }
  const [startSide, endSide] = best.sides
  if (!start.box) return [freeSide(from, to), endSide]
  if (!end.box) return [startSide, freeSide(to, from)]
  return [startSide, endSide]
}
