import { describe, expect, test } from 'bun:test'

import type { VectorNetwork, VectorSegment } from '@open-pencil/scene-graph'

import { deleteVectorParts, removeVertex } from '#core/vector/bezier'

const zero = { x: 0, y: 0 }

function line(start: number, end: number): VectorSegment {
  return { start, end, tangentStart: zero, tangentEnd: zero }
}

/** An open path through four points: 0 → 1 → 2 → 3. */
const OPEN: VectorNetwork = {
  vertices: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 }
  ],
  segments: [line(0, 1), line(1, 2), line(2, 3)],
  regions: []
}

/** A closed square, filled. */
const SQUARE: VectorNetwork = {
  ...OPEN,
  segments: [...OPEN.segments, line(3, 0)],
  regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2, 3]] }]
}

const ends = (network: VectorNetwork) => network.segments.map((s) => [s.start, s.end])

describe('deleting segments and points', () => {
  test('the middle segment of an open path splits it in two and keeps every point', () => {
    const result = deleteVectorParts(OPEN, [1], [])
    expect(result.vertices).toEqual(OPEN.vertices)
    expect(ends(result)).toEqual([
      [0, 1],
      [2, 3]
    ])
  })

  test('an end segment takes the point it leaves unconnected', () => {
    const result = deleteVectorParts(OPEN, [0], [])
    expect(result.vertices).toEqual(OPEN.vertices.slice(1))
    expect(ends(result)).toEqual([
      [0, 1],
      [1, 2]
    ])
  })

  test('a segment of a closed path opens it and drops its fill region', () => {
    const result = deleteVectorParts(SQUARE, [3], [])
    expect(result.vertices).toHaveLength(4)
    expect(ends(result)).toEqual(ends(OPEN))
    expect(result.regions).toEqual([])
  })

  test('a point takes its segments, and the points they leave unconnected', () => {
    const result = deleteVectorParts(OPEN, [], [1])
    expect(result.vertices).toEqual(OPEN.vertices.slice(2))
    expect(ends(result)).toEqual([[0, 1]])
  })

  test('points and segments delete together', () => {
    const result = deleteVectorParts(SQUARE, [1], [3])
    expect(result.vertices).toEqual(OPEN.vertices.slice(0, 2))
    expect(ends(result)).toEqual([[0, 1]])
  })

  test('deleting every segment leaves nothing', () => {
    const result = deleteVectorParts(OPEN, [0, 1, 2], [])
    expect(result.vertices).toEqual([])
    expect(result.segments).toEqual([])
  })

  test('region loops that keep all their segments are renumbered', () => {
    const network: VectorNetwork = {
      vertices: [...SQUARE.vertices, { x: 200, y: 0 }],
      segments: [line(1, 4), ...SQUARE.segments],
      regions: SQUARE.regions.map((region) => ({
        ...region,
        loops: region.loops.map((loop) => loop.map((index) => index + 1))
      }))
    }
    const result = deleteVectorParts(network, [0], [])
    expect(result.vertices).toEqual(SQUARE.vertices)
    expect(result.regions).toEqual(SQUARE.regions)
  })
})

describe('removing a point', () => {
  test('a point between two segments merges them and keeps its fill region', () => {
    const result = removeVertex(SQUARE, 1)
    expect(ends(result ?? OPEN)).toEqual([
      [0, 1],
      [1, 2],
      [2, 0]
    ])
    expect(result?.regions).toEqual([{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }])
  })

  test('a point with three segments opens the loops through it and drops their regions', () => {
    // A filled square with a spur from its corner 0, beside a filled triangle away from it.
    const network: VectorNetwork = {
      vertices: [
        ...SQUARE.vertices,
        { x: -100, y: 0 },
        { x: 200, y: 0 },
        { x: 300, y: 0 },
        { x: 200, y: 100 }
      ],
      segments: [...SQUARE.segments, line(0, 4), line(5, 6), line(6, 7), line(7, 5)],
      regions: [...SQUARE.regions, { windingRule: 'EVENODD', loops: [[5, 6, 7]] }]
    }
    const result = removeVertex(network, 0)
    expect(ends(result ?? OPEN)).toEqual([
      [0, 1],
      [1, 2],
      [4, 5],
      [5, 6],
      [6, 4]
    ])
    // The square's loop lost two sides; the triangle's keeps its segments, renumbered.
    expect(result?.regions).toEqual([{ windingRule: 'EVENODD', loops: [[2, 3, 4]] }])
  })
})
