import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { extractPaths, scalePathInfos } from '#core/icons/svg'

function span(values: number[]): number {
  return Math.max(...values) - Math.min(...values)
}

/** The issue's clock, drawn at size 12 inside a 24-unit viewBox. */
function scaledNetwork(d: string) {
  const path = expectDefined(
    scalePathInfos(
      extractPaths(`<path d="${d}" fill="none" stroke="#000" stroke-width="2.5"/>`),
      12 / 24,
      12 / 24
    )[0],
    'scaled path'
  )
  return path.vectorNetwork
}

describe('scalePathInfos', () => {
  test('keeps a nearly closed arc when scaling rounds its end onto its start', () => {
    // 11.99 scales to 5.995 and rounding to two decimals lands it on the start, 6.
    const network = scaledNetwork('M12 3A9 9 0 1 1 11.99 3Z')
    const width = span(network.vertices.map((vertex) => vertex.x))
    const height = span(network.vertices.map((vertex) => vertex.y))

    // A collapsed arc is one point. The scaled circle is 9 across.
    expect(network.segments.length).toBeGreaterThan(1)
    expect(width).toBeGreaterThan(8)
    expect(height).toBeGreaterThan(8)

    const clock = scaledNetwork('M12 3A9 9 0 1 1 11.99 3ZM12 7V12L15 14')
    expect(span(clock.vertices.map((vertex) => vertex.x))).toBeGreaterThan(8)
    expect(span(clock.vertices.map((vertex) => vertex.y))).toBeGreaterThan(8)
  })
})
