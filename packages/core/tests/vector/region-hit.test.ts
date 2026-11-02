import { describe, expect, test } from 'bun:test'

import type { VectorNetwork, VectorSegment } from '@open-pencil/scene-graph'

import { regionAtPoint, regionHatchPeriod, regionVertexIndices } from '#core/vector/region-hit'

const zero = { x: 0, y: 0 }
const line = (start: number, end: number): VectorSegment => ({
  start,
  end,
  tangentStart: zero,
  tangentEnd: zero
})

/** A 100 square (vertices 0–3) with a 40 square inside it (vertices 4–7). */
function squareWithInner(rule: 'NONZERO' | 'EVENODD'): VectorNetwork {
  return {
    vertices: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
      { x: 30, y: 30 },
      { x: 70, y: 30 },
      { x: 70, y: 70 },
      { x: 30, y: 70 }
    ],
    segments: [
      line(0, 1),
      line(1, 2),
      line(2, 3),
      line(3, 0),
      line(4, 5),
      line(5, 6),
      line(6, 7),
      line(7, 4)
    ],
    regions: [
      {
        windingRule: rule,
        loops: [
          [0, 1, 2, 3],
          [4, 5, 6, 7]
        ]
      }
    ]
  }
}

describe('the region under a point', () => {
  test('follows the region’s own fill rule', () => {
    // Both loops wind the same way: nonzero fills the middle, even-odd leaves a hole there.
    expect(regionAtPoint(squareWithInner('NONZERO'), { x: 50, y: 50 })).toBe(0)
    expect(regionAtPoint(squareWithInner('EVENODD'), { x: 50, y: 50 })).toBeNull()
    expect(regionAtPoint(squareWithInner('EVENODD'), { x: 10, y: 50 })).toBe(0)
    expect(regionAtPoint(squareWithInner('EVENODD'), { x: 150, y: 50 })).toBeNull()
  })

  test('is the last one where regions overlap, as in Figma', () => {
    const network = squareWithInner('NONZERO')
    network.regions = [
      { windingRule: 'NONZERO', loops: [[0, 1, 2, 3]] },
      { windingRule: 'NONZERO', loops: [[4, 5, 6, 7]] }
    ]
    expect(regionAtPoint(network, { x: 50, y: 50 })).toBe(1)
    expect(regionAtPoint(network, { x: 10, y: 50 })).toBe(0)
  })

  test('counts a curved edge where it bulges, not along its chord', () => {
    // A lens: the top edge bows up 50 above the chord y = 0.
    const network: VectorNetwork = {
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 30, y: -66 }, tangentEnd: { x: -30, y: -66 } },
        line(1, 0)
      ],
      regions: [{ windingRule: 'NONZERO', loops: [[0, 1]] }]
    }
    expect(regionAtPoint(network, { x: 50, y: -30 })).toBe(0)
    expect(regionAtPoint(network, { x: 50, y: 10 })).toBeNull()
  })

  test('places a point close inside a large curve on the right side', () => {
    // A lens 100000 wide: a fixed number of steps would cut hundreds of units off its bulge.
    const width = 100_000
    const network: VectorNetwork = {
      vertices: [
        { x: 0, y: 0 },
        { x: width, y: 0 }
      ],
      segments: [
        {
          start: 0,
          end: 1,
          tangentStart: { x: 0, y: -width },
          tangentEnd: { x: 0, y: -width }
        },
        line(1, 0)
      ],
      regions: [{ windingRule: 'NONZERO', loops: [[0, 1]] }]
    }
    // The edge at t = 17/32, between where coarse steps would sample it.
    const t = 17 / 32
    const u = 1 - t
    const edge = { x: (3 * u * t * t + t * t * t) * width, y: -3 * t * u * width }
    expect(regionAtPoint(network, { x: edge.x, y: edge.y + 1 })).toBe(0)
    expect(regionAtPoint(network, { x: edge.x, y: edge.y - 1 })).toBeNull()
  })
})

test('segments stored against the loop’s direction still enclose it', () => {
  // The same square, with its second and fourth sides stored backwards.
  const network = squareWithInner('NONZERO')
  network.segments[1] = line(2, 1)
  network.segments[3] = line(0, 3)
  network.regions = [{ windingRule: 'NONZERO', loops: [[0, 1, 2, 3]] }]
  expect(regionAtPoint(network, { x: 50, y: 50 })).toBe(0)
  expect(regionAtPoint(network, { x: 150, y: 50 })).toBeNull()
})

test('a region’s vertices are those on its loops', () => {
  expect(regionVertexIndices(squareWithInner('NONZERO'), 0).toSorted()).toEqual([
    0, 1, 2, 3, 4, 5, 6, 7
  ])
})

test('hatch lines are 8 px apart at 100% and keep a steady density as you zoom', () => {
  expect(regionHatchPeriod(1)).toBe(8)
  expect(regionHatchPeriod(2)).toBe(8)
  expect(regionHatchPeriod(1.3)).toBeCloseTo(10.4, 6)
  expect(regionHatchPeriod(1.5)).toBeCloseTo(6, 6)
})
