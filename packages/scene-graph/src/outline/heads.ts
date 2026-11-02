import {
  arrowLinesSegments,
  circleCapRadius,
  collectArrowEndpoints,
  diamondCapPoints,
  equilateralArrowPoints,
  triangleCapPoints
} from '../arrow-caps'
import type { Vector } from '../primitives'
import type { StrokeCap, VectorNetwork } from '../types'
import { containsByWinding, distanceToLines, distanceToSegment } from './point'

/** The outline of each filled head with corners, at an end pointing along `angle`. */
const HEAD_OUTLINES: Record<
  'ARROW_EQUILATERAL' | 'TRIANGLE_FILLED' | 'DIAMOND_FILLED',
  (x: number, y: number, angle: number, weight: number) => Vector[]
> = {
  ARROW_EQUILATERAL: equilateralArrowPoints,
  TRIANGLE_FILLED: triangleCapPoints,
  DIAMOND_FILLED: diamondCapPoints
}

/**
 * Whether the point lands on an arrow head drawn at the open ends of `network`, in its own
 * coordinates, within `pad`: inside a filled head or near its outline, or near a line arrow's
 * wings, which are stroked at the line's weight.
 */
export function hitsArrowHeads(
  network: VectorNetwork,
  cap: StrokeCap,
  weight: number,
  point: Vector,
  pad: number
): boolean {
  for (const { x, y, angle, cap: head } of collectArrowEndpoints(network, cap)) {
    if (head === 'CIRCLE_FILLED') {
      if (Math.hypot(point.x - x, point.y - y) <= circleCapRadius(weight) + pad) return true
      continue
    }
    if (head === 'ARROW_LINES') {
      const wings = arrowLinesSegments(x, y, angle, weight)
      if (wings.some((wing) => distanceToSegment(point, wing.from, wing.to) <= weight / 2 + pad)) {
        return true
      }
      continue
    }
    const outline = HEAD_OUTLINES[head](x, y, angle, weight)
    if (containsByWinding([outline], 'NONZERO', point)) return true
    if (distanceToLines([[...outline, outline[0]]], point) <= pad) return true
  }
  return false
}
