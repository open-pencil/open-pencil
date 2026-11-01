import { describe, expect, test } from 'bun:test'

import { parseSVGPath } from '@open-pencil/scene-graph/parse-path'

// An open outer square around a closed inner square, as filled icon sets often draw a ring.
const RING = 'M0 0h24v24H0M6 6v12h12V6z'

describe('parseSVGPath', () => {
  test('leaves open subpaths out of the fill region by default', () => {
    const network = parseSVGPath(RING)

    expect(network.regions).toHaveLength(1)
    expect(network.regions[0].loops).toEqual([[3, 4, 5, 6]])
  })

  test('puts open subpaths in the fill region with includeOpenRegions', () => {
    const network = parseSVGPath(RING, 'EVENODD', { includeOpenRegions: true })

    expect(network.regions).toEqual([
      {
        windingRule: 'EVENODD',
        loops: [
          [0, 1, 2],
          [3, 4, 5, 6]
        ]
      }
    ])
  })

  // Figma 126 imports a 318×80 rectangle with rx 12 as 8 vertices.
  test('closes a subpath whose last arc ends a hair off its start on the start vertex', () => {
    const network = parseSVGPath(
      'M12 0H306A12 12 0 0 1 318 12V68A12 12 0 0 1 306 80H12A12 12 0 0 1 0 68V12A12 12 0 0 1 12 0Z'
    )

    expect(network.vertices).toHaveLength(8)
    expect(network.segments.at(-1)?.end).toBe(0)
  })

  test('keeps the point a subpath ended on when other segments use it', () => {
    const network = parseSVGPath('M0 0L5 5L0.0000001 0L5 5L0.0000001 0Z')

    expect(network.vertices).toHaveLength(3)
    expect(network.segments.map(({ start, end }) => [start, end])).toEqual([
      [0, 1],
      [1, 2],
      [2, 1],
      [1, 0]
    ])
  })

  test('closes a tiny shape with a segment of its own rather than merging its points', () => {
    const network = parseSVGPath('M0 0L0.0005 0L0 0.0005Z')

    expect(network.vertices).toHaveLength(3)
    expect(network.segments.map(({ start, end }) => [start, end])).toEqual([
      [0, 1],
      [1, 2],
      [2, 0]
    ])
  })
})
