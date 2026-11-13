import { expect, test } from 'bun:test'

import type { Fill } from '@open-pencil/scene-graph'
import { paintShows } from '@open-pencil/scene-graph/paints'

const red = { r: 1, g: 0, b: 0, a: 1 }
const solid = (patch: Partial<Fill> = {}): Fill => ({
  type: 'SOLID',
  color: red,
  opacity: 1,
  visible: true,
  ...patch
})

// Figma desktop (2026-11-14): a fill at 0% opacity or hidden casts no shadow and has no render
// bounds; a clickable paint is one that shows something, so the two are one rule.
test('a paint shows when it is visible and not wholly transparent', () => {
  expect(paintShows(solid())).toBe(true)
  expect(paintShows(solid({ opacity: 0.01 }))).toBe(true)
  expect(paintShows(solid({ opacity: 0 }))).toBe(false)
  expect(paintShows(solid({ visible: false }))).toBe(false)
  expect(paintShows(solid({ color: { ...red, a: 0 } }))).toBe(false)
  expect(paintShows(solid({ opacity: Number.NaN }))).toBe(false)
  const stops = (a: number) => [
    { position: 0, color: { ...red, a } },
    { position: 1, color: { ...red, a: 0 } }
  ]
  expect(paintShows(solid({ type: 'GRADIENT_LINEAR', gradientStops: stops(0) }))).toBe(false)
  expect(paintShows(solid({ type: 'GRADIENT_LINEAR', gradientStops: stops(0.5) }))).toBe(true)
})
