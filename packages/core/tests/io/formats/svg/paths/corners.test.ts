import { expect, test } from 'bun:test'

import { roundedRectPath } from '#core/io/formats/svg/paths'

// Figma desktop (2026-11-14): a 100×100 rectangle with corners 90, 30, 0, 60 draws them at 60, 25,
// 0 and 40, each scaled by the tighter of its two edges.
test('an SVG rectangle fits oversized corners as Figma draws them', () => {
  const path = roundedRectPath({
    width: 100,
    height: 100,
    cornerRadius: 0,
    independentCorners: true,
    topLeftRadius: 90,
    topRightRadius: 30,
    bottomRightRadius: 0,
    bottomLeftRadius: 60
  })
  const arcs = [...path.matchAll(/A([\d.]+) /g)].map(([, radius]) => Number(radius))
  expect(arcs).toEqual([25, 40, 60])
})
