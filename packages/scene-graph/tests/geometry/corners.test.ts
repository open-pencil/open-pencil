import { describe, expect, test } from 'bun:test'

import { fittedCornerRadii } from '@open-pencil/scene-graph/geometry'

// Figma desktop (2026-11-14), read from each rectangle's fillGeometry: a corner too big for its
// box shrinks by the tighter of its two edges, each edge scaled by its length over the radii on it.
describe('corner radii too big for the box', () => {
  test('each corner takes the tighter factor of its two edges', () => {
    // Left edge holds 90 + 60 in 100, top 90 + 30: Figma draws 60, 25, 0, 40.
    expect(fittedCornerRadii(100, 100, [90, 30, 0, 60])).toEqual([60, 25, 0, 40])
  })

  test('a corner that fits its edges keeps its radius', () => {
    expect(fittedCornerRadii(100, 200, [80, 20, 0, 0])).toEqual([80, 20, 0, 0])
    expect(fittedCornerRadii(100, 100, [90, 10, 0, 0])).toEqual([90, 10, 0, 0])
  })

  test('two corners that share a short edge split it', () => {
    expect(fittedCornerRadii(100, 100, [90, 30, 0, 0])).toEqual([75, 25, 0, 0])
    expect(fittedCornerRadii(100, 40, [30, 30, 30, 30])).toEqual([20, 20, 20, 20])
    expect(fittedCornerRadii(100, 200, [200, 200, 200, 200])).toEqual([50, 50, 50, 50])
  })
})
