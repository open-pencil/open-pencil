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
})
