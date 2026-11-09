import { describe, expect, test } from 'bun:test'

import { rulerEdgeLabel, rulerLabel } from '#core/canvas/rulers'

// Figma desktop (2026-11-09) labels a selection's edges on the rulers to three decimals at any
// zoom: a layer at (8000.375, 8000.125), 151.256 × 33.333333, reads 8000.375, 8151.631, 8000.125,
// and 8033.458. Tick numbers stay whole.
describe('ruler labels', () => {
  test('a selection edge shows three decimals, as Figma labels it', () => {
    expect([8000.375, 8000.375 + 151.256, 8000.125, 8000.125 + 33.333333].map(rulerEdgeLabel)).toEqual(
      ['8000.375', '8151.631', '8000.125', '8033.458']
    )
    expect(rulerEdgeLabel(-0.0001)).toBe('0')
    expect(rulerEdgeLabel(120)).toBe('120')
  })

  test('tick numbers stay whole', () => {
    expect(rulerLabel(8050.4)).toBe('8050')
  })
})
