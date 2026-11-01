import { describe, expect, test } from 'bun:test'

import type { VectorNetwork, VectorSegment } from '@open-pencil/scene-graph'

import { isOpenVectorNetwork } from '#core/vector/connectivity'

const zero = { x: 0, y: 0 }
const line = (start: number, end: number): VectorSegment => ({
  start,
  end,
  tangentStart: zero,
  tangentEnd: zero
})
const corners = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 }
]

function network(segments: VectorSegment[], loops: number[][] = []): VectorNetwork {
  return {
    vertices: corners,
    segments,
    regions: loops.length > 0 ? [{ windingRule: 'NONZERO', loops }] : []
  }
}

describe('isOpenVectorNetwork', () => {
  test('is true for a path with loose ends', () => {
    expect(isOpenVectorNetwork(network([line(0, 1), line(1, 2)]))).toBe(true)
  })

  test('is false for a loop saved without a region', () => {
    expect(isOpenVectorNetwork(network([line(0, 1), line(1, 2), line(2, 3), line(3, 0)]))).toBe(
      false
    )
  })

  test('is false for a network with a region, even with a loose tail', () => {
    expect(
      isOpenVectorNetwork(network([line(0, 1), line(1, 2), line(2, 0), line(2, 3)], [[0, 1, 2]]))
    ).toBe(false)
  })
})
