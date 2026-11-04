import { describe, expect, test } from 'bun:test'

import type { Vector } from '@open-pencil/scene-graph/primitives'

import { freehandNetwork, simplifyFreehand } from '#core/vector/freehand'

const round = (value: number) => Math.round(value * 100) / 100

function knots(controls: Vector[], closed = false) {
  const network = freehandNetwork(controls, closed)
  return {
    vertices: network.vertices.map((v) => [round(v.x), round(v.y)]),
    segments: network.segments.map((s) => [
      s.start,
      s.end,
      [round(s.tangentStart.x), round(s.tangentStart.y)],
      [round(s.tangentEnd.x), round(s.tangentEnd.y)]
    ]),
    mirroring: network.vertices.map((v) => v.handleMirroring),
    regions: network.regions
  }
}

// Expected knots match Figma desktop's pencil for the same mouse samples, measured live.
describe('freehandNetwork', () => {
  test('rounds a corner as a B-spline knot', () => {
    const { vertices, segments } = knots([
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 200, y: 0 }
    ])
    expect(vertices).toEqual([
      [0, 0],
      [100, 66.67],
      [200, 0]
    ])
    expect(segments).toEqual([
      [0, 1, [33.33, 33.33], [-33.33, 0]],
      [1, 2, [33.33, 0], [-33.33, 33.33]]
    ])
  })

  test('places each inner knot from its neighbours', () => {
    const { vertices } = knots([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 100 }
    ])
    expect(vertices).toEqual([
      [0, 0],
      [100, 0],
      [183.33, 16.67],
      [200, 100]
    ])
  })

  test('keeps smooth vertices and no region', () => {
    const { mirroring, regions } = knots([
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 200, y: 0 }
    ])
    expect(mirroring).toEqual(['ANGLE', 'ANGLE', 'ANGLE'])
    expect(regions).toEqual([])
  })

  test('draws two controls as one straight segment', () => {
    expect(
      knots([
        { x: 0, y: 0 },
        { x: 300, y: 0 }
      ]).segments
    ).toEqual([[0, 1, [0, 0], [0, 0]]])
  })

  test('wraps a closed stroke round as one smooth outline', () => {
    const { vertices, segments, regions } = knots(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
        { x: 2, y: 1 }
      ],
      true
    )
    expect(vertices).toEqual([
      [16.67, 16.67],
      [83.33, 16.67],
      [83.33, 83.33],
      [16.67, 83.33]
    ])
    expect(segments.at(-1)?.slice(0, 2)).toEqual([3, 0])
    // The handles either side of the closing vertex mirror each other.
    expect(segments.at(-1)?.[3]).toEqual([-16.67, 16.67])
    expect(segments[0][2]).toEqual([16.67, -16.67])
    expect(regions).toEqual([])
  })
})

describe('simplifyFreehand', () => {
  test('collapses a straight stroke to its ends', () => {
    const line = Array.from({ length: 101 }, (_, i) => ({ x: 3 * i, y: 0 }))
    expect(simplifyFreehand(line, 2)).toEqual([
      { x: 0, y: 0 },
      { x: 300, y: 0 }
    ])
  })

  test('keeps the first sample after the press and the corners', () => {
    const corner = [
      ...Array.from({ length: 5 }, (_, i) => ({ x: 50 * i, y: 0 })),
      ...Array.from({ length: 4 }, (_, i) => ({ x: 200, y: 50 * (i + 1) }))
    ]
    expect(simplifyFreehand(corner, 2)).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 200 }
    ])
  })

  test('keeps about as many points however densely the stroke was sampled', () => {
    const arc = (samples: number) =>
      Array.from({ length: samples + 1 }, (_, i) => ({
        x: 80 * Math.cos((Math.PI * i) / samples),
        y: 80 * Math.sin((Math.PI * i) / samples)
      }))
    const sparse = simplifyFreehand(arc(72), 2).length
    const dense = simplifyFreehand(arc(288), 2).length
    expect(Math.abs(dense - sparse)).toBeLessThanOrEqual(1)
  })

  test('skips the first sample of a stroke that ends where it started', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
      { x: 0, y: 1 }
    ]
    expect(simplifyFreehand(square, 2, true)).not.toContainEqual({ x: 2, y: 0 })
    expect(simplifyFreehand(square, 2)).toContainEqual({ x: 2, y: 0 })
  })

  test('drops repeated samples', () => {
    expect(
      simplifyFreehand(
        [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 10, y: 0 }
        ],
        2
      )
    ).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 }
    ])
  })
})
