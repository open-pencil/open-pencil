import { describe, expect, test } from 'bun:test'

import {
  DEFAULT_GRADIENT_TRANSFORM,
  IDENTITY_GRADIENT_TRANSFORM,
  defaultGradientStops,
  ellipticalGradientTransform,
  gradientPoint,
  invertGradientTransform,
  linearGradientTransform
} from '@open-pencil/scene-graph/gradient'
import type { GradientTransform } from '@open-pencil/scene-graph'

function values(t: GradientTransform) {
  return [t.m00, t.m01, t.m02, t.m10, t.m11, t.m12].map((v) => +v.toFixed(6) + 0)
}

describe('gradient paints in Figma convention', () => {
  test('the identity runs from the left edge middle to the right edge middle', () => {
    expect(gradientPoint(IDENTITY_GRADIENT_TRANSFORM, { x: 0, y: 0.5 })).toEqual({ x: 0, y: 0.5 })
    expect(gradientPoint(IDENTITY_GRADIENT_TRANSFORM, { x: 1, y: 0.5 })).toEqual({ x: 1, y: 0.5 })
  })

  // Figma desktop 126 gives a fill switched to Linear this transform: top to bottom.
  test("Figma's default runs top to bottom", () => {
    expect(values(linearGradientTransform({ x: 0.5, y: 0 }, { x: 0.5, y: 1 }))).toEqual(
      values(DEFAULT_GRADIENT_TRANSFORM)
    )
    expect(gradientPoint(DEFAULT_GRADIENT_TRANSFORM, { x: 0.5, y: 0.5 })).toEqual({ x: 0.5, y: 0.5 })
  })

  test('a transform and its inverse undo each other', () => {
    const t = { m00: 2, m01: 0.3, m02: -0.2, m10: -0.4, m11: 1.5, m12: 0.1 }
    const back = invertGradientTransform(invertGradientTransform(t))
    expect(values(back)).toEqual(values(t))
  })

  test('an elliptical gradient is centred where its centre was given', () => {
    const t = ellipticalGradientTransform({ x: 0.35, y: 0.4 }, { x: 0.6, y: 0.4 }, { x: 0.35, y: 0.73 })
    const center = gradientPoint(t, { x: 0.5, y: 0.5 })
    expect(center.x).toBeCloseTo(0.35, 6)
    expect(center.y).toBeCloseTo(0.4, 6)
    expect(gradientPoint(t, { x: 1, y: 0.5 }).x).toBeCloseTo(0.6, 6)
  })

  // Figma desktop 126 turns FF4D33 into a gradient to 992E1F.
  test('a new gradient runs from the fill colour to a 60% shade of it', () => {
    const [first, second] = defaultGradientStops({ r: 1, g: 0x4d / 255, b: 0x33 / 255, a: 1 })
    expect(first?.position).toBe(0)
    const hex = [second?.color.r, second?.color.g, second?.color.b].map((c) =>
      Math.round((c ?? 0) * 255)
    )
    expect(hex).toEqual([0x99, 0x2e, 0x1f])
  })
})
