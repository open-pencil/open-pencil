import type { CubicBezier, Easing, Spring } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import {
  easingBezier,
  easingSpring,
  springPeak,
  springPosition,
  springSettleTime
} from '@open-pencil/scene-graph/variables'

/** A point in the graph's 100 × 100 box, y down. */
export type GraphPoint = Vector

/** The box a drawing fills, 100 units square, so positions read as percentages of the graph. */
export const GRAPH_SIZE = 100

/**
 * A curve's 0 to 1 across the graph, as Figma's editor fits it, with room on either side for the
 * handles.
 */
const CURVE_MARGIN = 22
const CURVE_SPAN = GRAPH_SIZE - 2 * CURVE_MARGIN
/** How close to the graph's edge a handle may sit and still be drawn whole. */
const HANDLE_MARGIN = 8

/** A spring's time runs along the graph between these; its target sits halfway up, leaving room to overshoot. */
const SPRING_START = 11
const SPRING_END = 89
const SPRING_ZERO = 88.6
const SPRING_UNIT = 38.9
const SPRING_SAMPLES = 96

/** Where a curve's values sit up the graph: the height of 0, and how far up 1 is from it. */
export interface CurveFrame {
  zero: number
  unit: number
}

/**
 * The frame that shows a curve and both its handles: the unit square at the scale of the width
 * where that fits, and squeezed, centred, where a back curve's handle goes further, such as Ease in
 * back's −0.5.
 */
export function curveFrame(bezier: CubicBezier | undefined): CurveFrame {
  const low = Math.min(0, bezier?.y1 ?? 0, bezier?.y2 ?? 0)
  const high = Math.max(1, bezier?.y1 ?? 1, bezier?.y2 ?? 1)
  const unit = Math.min(CURVE_SPAN, (GRAPH_SIZE - 2 * HANDLE_MARGIN) / (high - low))
  return { zero: GRAPH_SIZE / 2 + ((high + low) / 2) * unit, unit }
}

const SQUARE_FRAME = curveFrame(undefined)

export function curvePoint(x: number, y: number, frame = SQUARE_FRAME): GraphPoint {
  return { x: CURVE_MARGIN + x * CURVE_SPAN, y: frame.zero - y * frame.unit }
}

/** A point of the graph as a curve's numbers: x kept to 0 to 1, y to what the frame shows. */
export function curveValue(point: GraphPoint, frame: CurveFrame): Vector {
  const x = (point.x - CURVE_MARGIN) / CURVE_SPAN
  const y = (frame.zero - point.y) / frame.unit
  const lowest = (frame.zero - (GRAPH_SIZE - HANDLE_MARGIN)) / frame.unit
  const highest = (frame.zero - HANDLE_MARGIN) / frame.unit
  return { x: clamp(x, 0, 1), y: clamp(y, lowest, highest) }
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function path(points: readonly GraphPoint[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`)
    .join(' ')
}

/**
 * Where a drawing puts an easing's points: `x` from 0 to 1 across the curve's square or the
 * spring's settling time, `y` its value, 0 at the start and 1 at the target.
 */
export interface EasingPlacement {
  curve: (x: number, y: number) => GraphPoint
  spring: (x: number, y: number) => GraphPoint
}

/** Where the graph puts a spring: over its settling time, with room to overshoot. */
function springGraphPoint(x: number, y: number): GraphPoint {
  return { x: SPRING_START + x * (SPRING_END - SPRING_START), y: SPRING_ZERO - y * SPRING_UNIT }
}

/** Where the graph puts an easing: a curve in its frame, a spring with room to overshoot. */
function graphPlacement(frame: CurveFrame): EasingPlacement {
  return { curve: (x, y) => curvePoint(x, y, frame), spring: springGraphPoint }
}

/** An easing's line, placed: a curve, a spring over the time it takes to settle, or a hold. */
export function easingLine(easing: Easing, place: EasingPlacement): string {
  const spring = easingSpring(easing)
  if (spring) {
    const duration = springSettleTime(spring)
    return path(
      Array.from({ length: SPRING_SAMPLES + 1 }, (_, index) => {
        const x = index / SPRING_SAMPLES
        return place.spring(x, springPosition(spring, x * duration))
      })
    )
  }
  const bezier = easingBezier(easing)
  if (!bezier) return path([place.curve(0, 0), place.curve(1, 0), place.curve(1, 1)])
  const at = (point: GraphPoint) => `${round(point.x)} ${round(point.y)}`
  return `M${at(place.curve(0, 0))} C${at(place.curve(bezier.x1, bezier.y1))} ${at(
    place.curve(bezier.x2, bezier.y2)
  )} ${at(place.curve(1, 1))}`
}

/** Where the graph puts the moment `seconds` of `duration` and a spring's value there. */
function springPoint(seconds: number, value: number, duration: number): GraphPoint {
  return springGraphPoint(seconds / duration, value)
}

/** What the graph draws for an easing: its line, the guides behind it, and a curve's handle arms. */
export interface EasingDrawing {
  line: string
  guides: string
  arms: string
}

/** An easing's drawing: a curve in `frame`, a spring over the time it takes to settle. */
export function easingDrawing(easing: Easing, frame: CurveFrame): EasingDrawing {
  const line = easingLine(easing, graphPlacement(frame))
  if (easingSpring(easing)) {
    const target = springGraphPoint(0, 1).y
    return {
      line,
      guides: path([
        { x: SPRING_START, y: target },
        { x: SPRING_END, y: target }
      ]),
      arms: ''
    }
  }
  const at = (x: number, y: number) => curvePoint(x, y, frame)
  const guides = [path([at(0, 0), at(1, 0)]), path([at(0, 1), at(1, 1)])].join(' ')
  const bezier = easingBezier(easing)
  if (!bezier) return { line, guides, arms: '' }
  return {
    line,
    guides,
    arms: [
      path([at(0, 0), at(bezier.x1, bezier.y1)]),
      path([at(1, 1), at(bezier.x2, bezier.y2)])
    ].join(' ')
  }
}

/** Where a bouncing spring's handle sits: its first overshoot, or where it reaches 1 if it does not bounce. */
export function springHandle(spring: Spring): GraphPoint {
  const duration = springSettleTime(spring)
  const peak = springPeak(spring)
  // A spring damped close to critical peaks too little, too late, to draw: it sits at the end.
  if (peak && peak.seconds <= duration) return springPoint(peak.seconds, peak.value, duration)
  return springPoint(duration, 1, duration)
}

/** A graph height as how far past its target a spring goes, for dragging its handle. */
export function springOvershoot(point: GraphPoint): number {
  return clamp((SPRING_ZERO - point.y) / SPRING_UNIT - 1, 0, 1)
}

/** One drawing as an SVG document stroked in black, for a mask the size of the graph. */
export function graphSVG(d: string, strokeWidth: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRAPH_SIZE} ${GRAPH_SIZE}"><path d="${d}" fill="none" stroke="black" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/></svg>`
}
