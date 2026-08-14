import { describe, expect, test } from 'bun:test'

import { mergeVectorNetworks, type VectorNetwork } from '@open-pencil/scene-graph'

import { expectDefined } from '#tests/helpers/assert'

function lineNetwork(x: number): VectorNetwork {
  return {
    vertices: [
      { x, y: 0 },
      { x: x + 1, y: 1 }
    ],
    segments: [
      {
        start: 0,
        end: 1,
        tangentStart: { x: 0, y: 0 },
        tangentEnd: { x: 0, y: 0 }
      }
    ],
    regions: [{ windingRule: 'NONZERO', loops: [[0]] }]
  }
}

describe('mergeVectorNetworks', () => {
  test('offsets indices and returns independent geometry', () => {
    const first = lineNetwork(0)
    const second = lineNetwork(10)
    const merged = mergeVectorNetworks([first, second])

    expect(merged.vertices).toHaveLength(4)
    expect(merged.segments.map(({ start, end }) => [start, end])).toEqual([
      [0, 1],
      [2, 3]
    ])
    expect(merged.regions.map(({ loops }) => loops)).toEqual([[[0]], [[1]]])

    expectDefined(merged.vertices[0]).x = 50
    expectDefined(merged.segments[0]).tangentStart.x = 50
    expectDefined(expectDefined(merged.regions[0]).loops[0])[0] = 50
    expect(expectDefined(first.vertices[0]).x).toBe(0)
    expect(expectDefined(first.segments[0]).tangentStart.x).toBe(0)
    expect(expectDefined(expectDefined(first.regions[0]).loops[0])[0]).toBe(0)
  })
})
