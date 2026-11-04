import type { Rect, Vector } from '../primitives'
import { along, EPSILON, straightPieces, type ConnectorPiece } from './pieces'
import {
  attachment,
  opposite,
  OUTWARD,
  SIDES,
  type ConnectorRouteEnd,
  type ConnectorSide
} from './sides'

/** How far an elbow runs out of a layer before it may turn, unless the layers are closer. */
export const ELBOW_STUB = 48
/** What a turn costs against length, so that of two equally long routes the simpler wins. */
const BEND_COST = 1
/** What a run off the line midway between the layers costs, so turns land on that line. */
const OFF_MIDLINE_COST = 0.01

const DIRECTIONS: readonly Vector[] = SIDES.map((side) => OUTWARD[side])

/** How far `other` lies past `box`'s `side`: negative when it is not ahead of that side. */
function gapTowards(box: Rect, other: Rect, side: ConnectorSide): number {
  const { x, y } = OUTWARD[side]
  if (x > 0) return other.x - (box.x + box.width)
  if (x < 0) return box.x - (other.x + other.width)
  if (y > 0) return other.y - (box.y + box.height)
  return box.y - (other.y + other.height)
}

/** How far an elbow runs out of `box` by `side` before turning: its stub, or half the gap. */
function stubLength(box: Rect, other: Rect, side: ConnectorSide): number {
  const gap = gapTowards(box, other, side)
  return gap > 0 ? Math.min(ELBOW_STUB, gap / 2) : ELBOW_STUB
}

/** The line midway between two boxes along one axis, when they do not overlap on it. */
function midline(a0: number, a1: number, b0: number, b1: number): number | null {
  if (a1 < b0) return (a1 + b0) / 2
  if (b1 < a0) return (b1 + a0) / 2
  return null
}

function crossesBox(from: Vector, to: Vector, box: Rect | null): boolean {
  if (!box) return false
  const x0 = Math.min(from.x, to.x)
  const x1 = Math.max(from.x, to.x)
  const y0 = Math.min(from.y, to.y)
  const y1 = Math.max(from.y, to.y)
  return x1 > box.x && x0 < box.x + box.width && y1 > box.y && y0 < box.y + box.height
}

function asBox(end: ConnectorRouteEnd): Rect {
  return end.box ?? { x: end.point.x, y: end.point.y, width: 0, height: 0 }
}

/**
 * The candidate lines an elbow may run on: the stubs' ends, the boxes' centres, lines a stub's
 * length outside each box, and the lines midway between the boxes.
 */
interface Grid {
  xs: number[]
  ys: number[]
  midX: number | null
  midY: number | null
  from: Vector
  to: Vector
  obstacles: (Rect | null)[]
}

function elbowGrid(
  start: ConnectorRouteEnd,
  end: ConnectorRouteEnd,
  startSide: ConnectorSide,
  endSide: ConnectorSide
): Grid {
  const a = asBox(start)
  const b = asBox(end)
  const startStub = start.box ? stubLength(a, b, startSide) : 0
  const endStub = end.box ? stubLength(b, a, endSide) : 0
  const from = along(attachment(start, startSide), OUTWARD[startSide], startStub)
  const to = along(attachment(end, endSide), OUTWARD[endSide], endStub)
  const midX = midline(a.x, a.x + a.width, b.x, b.x + b.width)
  const midY = midline(a.y, a.y + a.height, b.y, b.y + b.height)
  const xs = new Set([from.x, to.x])
  const ys = new Set([from.y, to.y])
  for (const box of [start.box, end.box]) {
    if (!box) continue
    xs.add(box.x - ELBOW_STUB)
      .add(box.x + box.width + ELBOW_STUB)
      .add(box.x + box.width / 2)
    ys.add(box.y - ELBOW_STUB)
      .add(box.y + box.height + ELBOW_STUB)
      .add(box.y + box.height / 2)
  }
  if (midX !== null) xs.add(midX)
  if (midY !== null) ys.add(midY)
  return {
    xs: [...xs].sort((p, q) => p - q),
    ys: [...ys].sort((p, q) => p - q),
    midX,
    midY,
    from,
    to,
    obstacles: [start.box, end.box]
  }
}

interface GridState {
  cost: number
  /** Breaks ties between equal routes towards larger coordinates, as Figma goes round below. */
  tie: number
  i: number
  j: number
  direction: number
  previous: GridState | null
}

function cheaper(a: Pick<GridState, 'cost' | 'tie'>, b: Pick<GridState, 'cost' | 'tie'>): boolean {
  return a.cost < b.cost - EPSILON || (Math.abs(a.cost - b.cost) <= EPSILON && a.tie < b.tie)
}

function popCheapest(open: GridState[]): GridState {
  let index = 0
  for (let n = 1; n < open.length; n++) if (cheaper(open[n], open[index])) index = n
  return open.splice(index, 1)[0]
}

/** The states one run along a grid line away, that do not cross either box. */
function stepsFrom(grid: Grid, state: GridState): GridState[] {
  const steps: GridState[] = []
  for (let direction = 0; direction < 4; direction++) {
    if (direction === (state.direction + 2) % 4) continue
    const step = DIRECTIONS[direction]
    const i = state.i + Math.sign(step.x)
    const j = state.j + Math.sign(step.y)
    if (i < 0 || j < 0 || i >= grid.xs.length || j >= grid.ys.length) continue
    const p = { x: grid.xs[state.i], y: grid.ys[state.j] }
    const q = { x: grid.xs[i], y: grid.ys[j] }
    if (grid.obstacles.some((box) => crossesBox(p, q, box))) continue
    const length = Math.abs(q.x - p.x) + Math.abs(q.y - p.y)
    const onMidline = step.x === 0 ? q.x === grid.midX : q.y === grid.midY
    const turn = direction === state.direction ? 0 : BEND_COST
    steps.push({
      cost: state.cost + length + turn + (onMidline ? 0 : OFF_MIDLINE_COST),
      tie: state.tie - (step.x === 0 ? q.x : q.y) * length,
      i,
      j,
      direction,
      previous: state
    })
  }
  return steps
}

/** The cheapest walk on the grid from the start stub to the end stub, entering it head on. */
function cheapestWalk(grid: Grid, startSide: ConnectorSide, endSide: ConnectorSide) {
  const target = { i: grid.xs.indexOf(grid.to.x), j: grid.ys.indexOf(grid.to.y) }
  const arrival = SIDES.indexOf(opposite(endSide))
  const key = (state: GridState) => (state.i * grid.ys.length + state.j) * 4 + state.direction
  const best = new Map<number, GridState>()
  const open: GridState[] = []
  const offer = (state: GridState) => {
    const known = best.get(key(state))
    if (known && !cheaper(state, known)) return
    best.set(key(state), state)
    open.push(state)
  }
  offer({
    cost: 0,
    tie: 0,
    i: grid.xs.indexOf(grid.from.x),
    j: grid.ys.indexOf(grid.from.y),
    direction: SIDES.indexOf(startSide),
    previous: null
  })
  let done: GridState | null = null
  while (open.length > 0) {
    const state = popCheapest(open)
    if (best.get(key(state)) !== state) continue
    if (done && state.cost > done.cost + EPSILON) break
    if (state.i === target.i && state.j === target.j) {
      // Entering the end's stub from aside costs one more turn.
      const arrived = { ...state, cost: state.cost + (state.direction === arrival ? 0 : BEND_COST) }
      if (!done || cheaper(arrived, done)) done = arrived
      continue
    }
    for (const next of stepsFrom(grid, state)) offer(next)
  }
  return done
}

/** Drops repeated points and points in the middle of a straight run. */
export function simplify(points: Vector[]): Vector[] {
  const result: Vector[] = []
  const same = (a: number, b: number) => Math.abs(a - b) < EPSILON
  for (const point of points) {
    const last = result.at(-1)
    if (last && same(last.x, point.x) && same(last.y, point.y)) continue
    const before = result.at(-2)
    if (
      before &&
      last &&
      ((same(before.x, last.x) && same(last.x, point.x)) ||
        (same(before.y, last.y) && same(last.y, point.y)))
    ) {
      result.pop()
    }
    result.push(point)
  }
  return result
}

/**
 * An elbow between two ends: the shortest route on the grid that avoids both layers, turns
 * penalised and placed midway between the layers where they can be, from the start's gap point to
 * the end's. Null when no route avoids the layers.
 */
export function elbowRoute(
  start: ConnectorRouteEnd,
  end: ConnectorRouteEnd,
  sides: [ConnectorSide, ConnectorSide],
  gaps: [number, number]
): ConnectorPiece[] | null {
  const [startSide, endSide] = sides
  const grid = elbowGrid(start, end, startSide, endSide)
  const walk = cheapestWalk(grid, startSide, endSide)
  if (!walk) return null
  const turns: Vector[] = []
  for (let state: GridState | null = walk; state; state = state.previous) {
    turns.unshift({ x: grid.xs[state.i], y: grid.ys[state.j] })
  }
  const from = along(attachment(start, startSide), OUTWARD[startSide], gaps[0])
  const to = along(attachment(end, endSide), OUTWARD[endSide], gaps[1])
  return straightPieces(simplify([from, ...turns, to]))
}
