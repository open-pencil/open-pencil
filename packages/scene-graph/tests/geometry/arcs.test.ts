import { expect, test } from 'bun:test'

import { isWholeArc } from '@open-pencil/scene-graph/geometry'

// Figma desktop (2026-11-14), read from each ellipse's fillGeometry: a sweep less than 0.001 rad
// short of a whole turn draws the whole ellipse, from any start; 0.001 short draws an arc.
test('a sweep within 0.001 rad of a whole turn is a whole ellipse, as Figma draws it', () => {
  const sweep = (short: number, start = 0) => ({
    startingAngle: start,
    endingAngle: start + 2 * Math.PI - short,
    innerRadius: 0
  })
  for (const short of [0, 0.0005, 0.00095]) {
    expect(isWholeArc(sweep(short))).toBe(true)
    expect(isWholeArc(sweep(short, 1))).toBe(true)
  }
  for (const short of [0.001, 0.01]) expect(isWholeArc(sweep(short))).toBe(false)
})
