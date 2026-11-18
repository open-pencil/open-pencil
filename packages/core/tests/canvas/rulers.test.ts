import { describe, expect, test } from 'bun:test'

import { rulerEdgeLabel, rulerLabel, separatedBadgeCenters } from '#core/canvas/rulers'

// Figma desktop (2026-11-09) labels a selection's edges on the rulers to three decimals at any
// zoom: a layer at (8000.375, 8000.125), 151.256 × 33.333333, reads 8000.375, 8151.631, 8000.125,
// and 8033.458. Tick numbers stay whole.
describe('ruler labels', () => {
  test('a selection edge shows three decimals, as Figma labels it', () => {
    expect(
      [8000.375, 8000.375 + 151.256, 8000.125, 8000.125 + 33.333333].map(rulerEdgeLabel)
    ).toEqual(['8000.375', '8151.631', '8000.125', '8033.458'])
    expect(rulerEdgeLabel(-0.0001)).toBe('0')
    expect(rulerEdgeLabel(120)).toBe('120')
  })

  test('a narrow selection’s edge badges part rather than overlap', () => {
    // Edges far apart keep their badges centered on them.
    expect(separatedBadgeCenters([100, 300], [50, 50])).toEqual([100, 300])
    // 30 px apart with 50 px badges: they part evenly, 2 px apart.
    const [near, far] = separatedBadgeCenters([100, 130], [50, 50])
    expect(far - 25 - (near + 25)).toBe(2)
    expect((near + far) / 2).toBe(115)
  })

  test('tick numbers stay whole', () => {
    expect(rulerLabel(8050.4)).toBe('8050')
  })
})
