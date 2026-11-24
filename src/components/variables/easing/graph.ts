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
 * A curve's unit square in the graph, as Figma's editor fits it: a margin on every side leaves
 * room for handles and back curves that leave 0 to 1.
 */
const CURVE_MARGIN = 22
const CURVE_SPAN = GRAPH_SIZE - 2 * CURVE_MARGIN

/** A spring's time runs along the graph between these; its target sits halfway up, leaving room to overshoot. */
const SPRING_START = 11
const SPRING_END = 89
const SPRING_ZERO = 88.6
const SPRING_UNIT = 38.9
const SPRING_SAMPLES = 96

export function curvePoint(x: number, y: number): GraphPoint {
  return { x: CURVE_MARGIN + x * CURVE_SPAN, y: CURVE_MARGIN + (1 - y) * CURVE_SPAN }
}

/** A point of the graph as a curve's numbers: x kept to 0 to 1, y to what the graph shows. */
export function curveValue(point: GraphPoint): Vector {
  const lowest = -CURVE_MARGIN / CURVE_SPAN
  const highest = 1 + CURVE_MARGIN / CURVE_SPAN
  const x = (point.x - CURVE_MARGIN) / CURVE_SPAN
  const y = 1 - (point.y - CURVE_MARGIN) / CURVE_SPAN
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

function bezierPath(bezier: CubicBezier): string {
  const start = curvePoint(0, 0)
  const first = curvePoint(bezier.x1, bezier.y1)
  const second = curvePoint(bezier.x2, bezier.y2)
  const end = curvePoint(1, 1)
  const at = (point: GraphPoint) => `${round(point.x)} ${round(point.y)}`
  return `M${at(start)} C${at(first)} ${at(second)} ${at(end)}`
}

/** Where a spring's graph puts the moment `seconds` of `duration` and the value there. */
function springPoint(seconds: number, value: number, duration: number): GraphPoint {
  return {
    x: SPRING_START + (seconds / duration) * (SPRING_END - SPRING_START),
    y: SPRING_ZERO - value * SPRING_UNIT
  }
}

function springPath(spring: Spring): string {
  const duration = springSettleTime(spring)
  const points = Array.from({ length: SPRING_SAMPLES + 1 }, (_, index) => {
    const seconds = (index / SPRING_SAMPLES) * duration
    return springPoint(seconds, springPosition(spring, seconds), duration)
  })
  return path(points)
}

/** What the graph draws for an easing: its line, the guides behind it, and a curve's handle arms. */
export interface EasingDrawing {
  line: string
  guides: string
  arms: string
}

/** An easing's drawing: a curve in its unit square, a spring over the time it takes to settle. */
export function easingDrawing(easing: Easing): EasingDrawing {
  const spring = easingSpring(easing)
  if (spring) {
    const target = springPoint(0, 1, 1).y
    return {
      line: springPath(spring),
      guides: path([
        { x: SPRING_START, y: target },
        { x: SPRING_END, y: target }
      ]),
      arms: ''
    }
  }
  const guides = [
    path([curvePoint(0, 0), curvePoint(1, 0)]),
    path([curvePoint(0, 1), curvePoint(1, 1)])
  ].join(' ')
  const bezier = easingBezier(easing)
  if (!bezier)
    return { line: path([curvePoint(0, 0), curvePoint(1, 0), curvePoint(1, 1)]), guides, arms: '' }
  return {
    line: bezierPath(bezier),
    guides,
    arms: [
      path([curvePoint(0, 0), curvePoint(bezier.x1, bezier.y1)]),
      path([curvePoint(1, 1), curvePoint(bezier.x2, bezier.y2)])
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
