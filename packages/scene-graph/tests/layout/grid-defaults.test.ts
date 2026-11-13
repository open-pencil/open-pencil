import { expect, test } from 'bun:test'

import {
  DEFAULT_LAYOUT_GRID_COLOR,
  layoutGridAlignment,
  layoutGridColor,
  layoutGridPattern
} from '@open-pencil/scene-graph/layout'

// One reading of a guide for the canvas, the plugin API and export: a guide set without an
// alignment stretches, and one without a color takes Figma's new-guide red at 10%.
test('a guide reads the same pattern, alignment and color everywhere', () => {
  expect(layoutGridPattern({ axis: 'Y' })).toBe('ROWS')
  expect(layoutGridPattern({ pattern: 'GRID' })).toBe('GRID')
  expect(layoutGridAlignment({})).toBe('STRETCH')
  expect(layoutGridAlignment({ type: 'CENTER' })).toBe('CENTER')
  expect(layoutGridColor({})).toEqual(DEFAULT_LAYOUT_GRID_COLOR)
  expect(DEFAULT_LAYOUT_GRID_COLOR).toEqual({ r: 1, g: 0, b: 0, a: 0.1 })
})
