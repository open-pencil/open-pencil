import { describe, expect, test } from 'bun:test'

import type { VectorNetwork } from '@open-pencil/scene-graph'
import { parseSVGPath } from '@open-pencil/scene-graph/parse-path'
import {
  mergeVectorNetworks,
  vectorNetworkPaths,
  vectorNetworkToSVGPaths
} from '@open-pencil/scene-graph/vector-network'

import { expectDefined } from './helpers/assert'

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

describe('vectorNetworkToSVGPaths()', () => {
  test('single straight segment', () => {
    const paths = vectorNetworkToSVGPaths({
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 100 }
      ],
      segments: [
        {
          start: 0,
          end: 1,
          tangentStart: { x: 0, y: 0 },
          tangentEnd: { x: 0, y: 0 }
        }
      ],
      regions: []
    })
    expect(paths).toHaveLength(1)
    expect(paths[0]).toContain('M0 0')
    expect(paths[0]).toContain('L100 100')
  })

  test('curved segment', () => {
    const paths = vectorNetworkToSVGPaths({
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ],
      segments: [
        {
          start: 0,
          end: 1,
          tangentStart: { x: 0, y: 50 },
          tangentEnd: { x: 0, y: 50 }
        }
      ],
      regions: []
    })
    expect(paths).toHaveLength(1)
    expect(paths[0]).toContain('C')
  })

  test('traces arbitrarily ordered open segments as one path', () => {
    const paths = vectorNetworkToSVGPaths({
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 30, y: 0 }
      ],
      segments: [
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 2, end: 3, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: []
    })

    expect(paths).toEqual(['M0 0L10 0L20 0L30 0'])
  })

  test('region with loop', () => {
    const paths = vectorNetworkToSVGPaths({
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 100 }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 2, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }]
    })
    expect(paths).toHaveLength(1)
    expect(paths[0]).toContain('M0 0')
    expect(paths[0]).toContain('Z')
  })

  test('traces non-directional region segments continuously', () => {
    const paths = vectorNetworkToSVGPaths({
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 100 }
      ],
      segments: [
        { start: 1, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 0, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }]
    })

    expect(paths).toEqual(['M0 0L100 0L50 100L0 0Z'])
  })

  test('starts a new subpath for disconnected region segments', () => {
    const paths = vectorNetworkToSVGPaths({
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 30, y: 0 }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 2, end: 3, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: [{ windingRule: 'NONZERO', loops: [[0, 1]] }]
    })

    expect(paths).toEqual(['M0 0L10 0M20 0L30 0'])
  })

  test('recognizes closed unfilled segment chains', () => {
    const paths = vectorNetworkToSVGPaths({
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 10 }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 2, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: []
    })

    expect(paths).toEqual(['M10 0L0 10L0 0L10 0Z'])
  })

  test('empty network', () => {
    const paths = vectorNetworkToSVGPaths({ vertices: [], segments: [], regions: [] })
    expect(paths).toHaveLength(0)
  })
})

describe('vectorNetworkToSVGPaths() with regions and open segments', () => {
  const corner = { x: 0, y: 0 }
  const line = (start: number, end: number) => ({
    start,
    end,
    tangentStart: corner,
    tangentEnd: corner
  })

  /** A skip-back icon: a filled triangle beside a bar, which no region encloses. */
  const network: VectorNetwork = {
    vertices: [
      { x: 19, y: 20 },
      { x: 9, y: 12 },
      { x: 19, y: 4 },
      { x: 5, y: 19 },
      { x: 5, y: 5 }
    ],
    segments: [line(0, 1), line(1, 2), line(2, 0), line(3, 4)],
    regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }]
  }

  test('segments outside every region draw as open paths after the regions', () => {
    expect(vectorNetworkToSVGPaths(network)).toEqual(['M19 20L9 12L19 4L19 20Z', 'M5 19L5 5'])
  })

  test('a network with regions only draws the regions', () => {
    expect(vectorNetworkToSVGPaths({ ...network, segments: network.segments.slice(0, 3) })).toEqual(
      ['M19 20L9 12L19 4L19 20Z']
    )
  })
})

describe('vectorNetworkPaths()', () => {
  const still = { x: 0, y: 0 }
  const segment = (start: number, end: number, tangentStart = still, tangentEnd = still) => ({
    start,
    end,
    tangentStart,
    tangentEnd
  })
  /** A network's segments by their end points, in either direction. */
  const segmentsOf = (network: VectorNetwork) =>
    network.segments
      .map(({ start, end }) =>
        [network.vertices[start], network.vertices[end]]
          .map(({ x, y }) => `${x},${y}`)
          .sort()
          .join(' ')
      )
      .sort()
  /** The paths, and that parsing them back draws every segment once. */
  const traced = (network: VectorNetwork) => {
    const paths = vectorNetworkPaths(network)
    const back = parseSVGPath(paths.map((path) => path.data).join(''), 'NONZERO')
    expect(segmentsOf(back)).toEqual(segmentsOf(network))
    return paths
  }

  test('has no paths for an empty network', () => {
    expect(vectorNetworkPaths({ vertices: [], segments: [], regions: [] })).toEqual([])
  })

  test('keeps full precision', () => {
    const network: VectorNetwork = {
      vertices: [
        { x: 0.123456789, y: 0 },
        { x: 10, y: 1 / 3 }
      ],
      segments: [segment(0, 1)],
      regions: []
    }
    expect(traced(network)).toEqual([
      { windingRule: 'NONE', data: 'M0.123456789 0L10 0.3333333333333333' }
    ])
  })

  test('draws every branch of a vertex three segments meet at', () => {
    const network: VectorNetwork = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 10 },
        { x: 20, y: -10 }
      ],
      segments: [segment(0, 1), segment(1, 2), segment(1, 3)],
      regions: []
    }
    expect(traced(network)).toEqual([{ windingRule: 'NONE', data: 'M0 0L10 0L20 10M10 0L20 -10' }])
  })

  test('keeps a segment of no length', () => {
    const network: VectorNetwork = {
      vertices: [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      segments: [segment(0, 1), segment(1, 2)],
      regions: []
    }
    expect(traced(network)).toEqual([{ windingRule: 'NONE', data: 'M0 0L0 0L10 0' }])
  })

  test('follows segments written against the way their loop runs, curves included', () => {
    const loop: VectorNetwork = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 }
      ],
      segments: [segment(0, 1), segment(2, 1), segment(0, 2)],
      regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }]
    }
    expect(traced(loop)).toEqual([{ windingRule: 'NONZERO', data: 'M0 0L10 0L10 10L0 0Z' }])
    const curve: VectorNetwork = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      segments: [segment(1, 0, { x: 0, y: 5 }, { x: 0, y: 5 })],
      regions: []
    }
    expect(traced(curve)).toEqual([{ windingRule: 'NONE', data: 'M10 0C10 5 0 5 0 0' }])
  })

  test('closes each loop of a region, loops that share a vertex too', () => {
    const network: VectorNetwork = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 5 },
        { x: 0, y: 10 },
        { x: 10, y: 10 }
      ],
      segments: [
        segment(0, 1),
        segment(1, 2),
        segment(2, 0),
        segment(2, 3),
        segment(3, 4),
        segment(4, 2)
      ],
      regions: [
        {
          windingRule: 'EVENODD',
          loops: [
            [0, 1, 2],
            [3, 4, 5]
          ]
        }
      ]
    }
    expect(traced(network)).toEqual([
      { windingRule: 'EVENODD', data: 'M0 0L10 0L5 5L0 0ZM5 5L0 10L10 10L5 5Z' }
    ])
  })

  test('skips a region with no loops and keeps the winding rule of the next', () => {
    const network: VectorNetwork = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 }
      ],
      segments: [segment(0, 1), segment(1, 2), segment(2, 0)],
      regions: [
        { windingRule: 'NONZERO', loops: [] },
        { windingRule: 'EVENODD', loops: [[0, 1, 2]] }
      ]
    }
    expect(traced(network)).toEqual([{ windingRule: 'EVENODD', data: 'M0 0L10 0L10 10L0 0Z' }])
  })
})
