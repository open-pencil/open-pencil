import type { StrokeCap } from '../types'
import type { ConnectorRouteEnd } from './sides'

type GapTable = readonly (readonly [number, number])[]

const ROUND_GAP: GapTable = [
  [1, 3],
  [2, 3.5],
  [4, 6],
  [8, 10.5]
]
const ARROW_LINES_GAP: GapTable = [
  [1, 3],
  [2, 3.5],
  [4, 6.5],
  [8, 10.5]
]
const TRIANGLE_GAP: GapTable = [
  [1, 3],
  [4, 4.5],
  [8, 6.5]
]
const ON_EDGE: GapTable = [[1, 0]]

/**
 * How far a bound end stops short of its layer, by cap and stroke weight; heavier strokes keep the
 * last gap. Diamonds and circles sit on the layer's edge. The equilateral arrow's gap barely
 * changes, and differs slightly between the start and the end.
 */
const CAP_GAPS: Record<StrokeCap, { start: GapTable; end: GapTable }> = {
  NONE: { start: ROUND_GAP, end: ROUND_GAP },
  ROUND: { start: ROUND_GAP, end: ROUND_GAP },
  SQUARE: { start: ROUND_GAP, end: ROUND_GAP },
  ARROW_LINES: { start: ARROW_LINES_GAP, end: ARROW_LINES_GAP },
  ARROW_EQUILATERAL: {
    start: [[1, 3.25]],
    end: [
      [1, 2.75],
      [4, 3.34],
      [8, 3.39]
    ]
  },
  TRIANGLE_FILLED: { start: TRIANGLE_GAP, end: TRIANGLE_GAP },
  DIAMOND_FILLED: { start: ON_EDGE, end: ON_EDGE },
  CIRCLE_FILLED: { start: ON_EDGE, end: ON_EDGE }
}

function interpolate(table: GapTable, x: number): number {
  const [firstX, firstY] = table[0]
  if (x <= firstX) return firstY
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i]
    if (x <= x1) {
      const [x0, y0] = table[i - 1]
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
    }
  }
  return table[table.length - 1][1]
}

/**
 * How far a bound end stops short of its layer's box, so its cap does not touch the layer: the
 * cap's gap past the layer's outline, except for caps that sit on the edge.
 */
export function connectorEndGap(
  end: Pick<ConnectorRouteEnd, 'cap' | 'outline'>,
  strokeWeight: number,
  at: 'start' | 'end'
): number {
  const gap = interpolate(CAP_GAPS[end.cap][at], strokeWeight)
  return gap > 0 ? gap + end.outline : 0
}
