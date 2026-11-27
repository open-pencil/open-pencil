import { pointAt, subPiece, type ConnectorPiece } from '../connectors/pieces'
import type { PolygonOutlineCommand } from '../polygon'
import type { Vector } from '../primitives'

/**
 * How far above the bottom a document's wave meets its left and right sides, and how far its
 * crest rises, as FigJam draws it at every size. Below FigJam's least height the wave shrinks
 * with the page.
 */
const WAVE_LEFT = 16
const WAVE_RIGHT = 15
const WAVE_CREST = 31
const LEAST_HEIGHT = 80
/** Bezier handle length for a quarter circle. */
const KAPPA = 0.5522847498
/** Steps that measure a stretch of curve, and halvings that find where a length ends. */
const LENGTH_STEPS = 32
const SEARCH_STEPS = 30
const UP: Vector = { x: 0, y: -1 }

function piece(from: Vector, c1: Vector, c2: Vector, to: Vector): ConnectorPiece {
  return {
    from,
    to,
    handleFrom: { x: c1.x - from.x, y: c1.y - from.y },
    handleTo: { x: c2.x - to.x, y: c2.y - to.y }
  }
}

function reversed(curve: ConnectorPiece): ConnectorPiece {
  return { from: curve.to, to: curve.from, handleFrom: curve.handleTo, handleTo: curve.handleFrom }
}

/** The bottom wave, right to left: up from the right side to its crest, down to its trough, up to the left side. */
function wave(w: number, h: number): ConnectorPiece[] {
  const scale = Math.min(1, h / LEAST_HEIGHT)
  const left = { x: 0, y: h - WAVE_LEFT * scale }
  const trough = { x: (w * 13) / 48, y: h }
  const crest = { x: (w * 17) / 24, y: h - WAVE_CREST * scale }
  const right = { x: w, y: h - WAVE_RIGHT * scale }
  return [
    piece(right, right, { x: w * 0.854555, y: crest.y }, crest),
    piece(crest, { x: w * 0.5625, y: crest.y }, { x: w * 0.413004, y: h }, trough),
    piece(trough, { x: (w * 13) / 96, y: h }, left, left)
  ]
}

function unit(v: Vector): Vector {
  const length = Math.hypot(v.x, v.y)
  return length > 0 ? { x: v.x / length, y: v.y / length } : { x: 0, y: 0 }
}

/** The direction a curve leaves its start in, past handles of no length. */
function leaving(curve: ConnectorPiece): Vector {
  const { from, to, handleFrom, handleTo } = curve
  const c1 = { x: from.x + handleFrom.x, y: from.y + handleFrom.y }
  const c2 = { x: to.x + handleTo.x, y: to.y + handleTo.y }
  for (const point of [c1, c2, to]) {
    const direction = unit({ x: point.x - from.x, y: point.y - from.y })
    if (direction.x !== 0 || direction.y !== 0) return direction
  }
  return { x: 0, y: 0 }
}

/** The length of a curve from its start to `t`. */
function lengthTo(curve: ConnectorPiece, t: number): number {
  let length = 0
  let last = curve.from
  for (let step = 1; step <= LENGTH_STEPS; step++) {
    const point = pointAt(curve, (t * step) / LENGTH_STEPS)
    length += Math.hypot(point.x - last.x, point.y - last.y)
    last = point
  }
  return length
}

/** The parameter at `distance` along a curve from its start, by its length. */
function parameterAt(curve: ConnectorPiece, distance: number): number {
  let low = 0
  let high = 1
  for (let step = 0; step < SEARCH_STEPS; step++) {
    const middle = (low + high) / 2
    if (lengthTo(curve, middle) < distance) low = middle
    else high = middle
  }
  return (low + high) / 2
}

/**
 * How far a corner of `radius` trims each side of a vertex whose sides leave it along `a` and
 * `b`, and how long its handles are. FigJam fits a circle to a blunt corner; a sharp one it trims
 * by the radius alone, with a quarter circle's handles.
 */
function corner(a: Vector, b: Vector, radius: number): { trim: number; handle: number } {
  const angle = Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y)))
  if (angle <= Math.PI / 2) return { trim: radius, handle: radius * KAPPA }
  return {
    trim: radius / Math.tan(angle / 2),
    handle: (4 / 3) * Math.tan((Math.PI - angle) / 4) * radius
  }
}

function curveTo(c1: Vector, c2: Vector, to: Vector): PolygonOutlineCommand {
  return { type: 'C', x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y, x: to.x, y: to.y }
}

function pieceTo(curve: ConnectorPiece): PolygonOutlineCommand {
  const { from, to, handleFrom, handleTo } = curve
  return curveTo(
    { x: from.x + handleFrom.x, y: from.y + handleFrom.y },
    { x: to.x + handleTo.x, y: to.y + handleTo.y },
    to
  )
}

/**
 * A single document as FigJam draws it: a page whose bottom is a wave of fixed height, every
 * corner rounded to `radius`, those where the wave meets the sides included.
 */
export function documentOutline(w: number, h: number, radius: number): PolygonOutlineCommand[] {
  const [fromRight, middle, toLeft] = wave(w, h)
  const r = Math.max(0, Math.min(radius, w / 2, h / 2))
  const k = r * (1 - KAPPA)
  const rightSide = fromRight.from
  const leftSide = toLeft.to
  const intoLeft = reversed(toLeft)

  // Each bottom corner trims the side and the wave by the same length, the side no further than
  // its top corner.
  const right = corner(UP, leaving(fromRight), r)
  const left = corner(UP, leaving(intoLeft), r)
  const rightTrim = Math.min(right.trim, (rightSide.y - r) / 2)
  const leftTrim = Math.min(left.trim, (leftSide.y - r) / 2)
  const first = r > 0 ? subPiece(fromRight, parameterAt(fromRight, rightTrim), 1) : fromRight
  const last = r > 0 ? subPiece(toLeft, 0, 1 - parameterAt(intoLeft, leftTrim)) : toLeft
  const rightEnd = { x: w, y: rightSide.y - rightTrim }
  const leftEnd = { x: 0, y: leftSide.y - leftTrim }

  const commands: PolygonOutlineCommand[] = [
    { type: 'M', x: r, y: 0 },
    { type: 'L', x: w - r, y: 0 },
    curveTo({ x: w - k, y: 0 }, { x: w, y: k }, { x: w, y: r }),
    { type: 'L', x: rightEnd.x, y: rightEnd.y }
  ]
  if (r > 0) {
    const back = unit({ x: -first.handleFrom.x, y: -first.handleFrom.y })
    commands.push(
      curveTo(
        { x: w, y: rightEnd.y + right.handle },
        { x: first.from.x + back.x * right.handle, y: first.from.y + back.y * right.handle },
        first.from
      )
    )
  }
  commands.push(pieceTo(first), pieceTo(middle), pieceTo(last))
  if (r > 0) {
    const on = unit({ x: -last.handleTo.x, y: -last.handleTo.y })
    commands.push(
      curveTo(
        { x: last.to.x + on.x * left.handle, y: last.to.y + on.y * left.handle },
        { x: 0, y: leftEnd.y + left.handle },
        leftEnd
      )
    )
  }
  commands.push(
    { type: 'L', x: 0, y: r },
    curveTo({ x: 0, y: k }, { x: k, y: 0 }, { x: r, y: 0 }),
    { type: 'Z' }
  )
  return commands
}
