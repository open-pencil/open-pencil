import { describe, expect, test } from 'bun:test'

import type { VectorNetwork, VectorSegment } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { extractPaths, extractPathsFromElements, scalePathInfos } from '#core/icons/svg'
import { parseSVGSize, parseSVGViewBox } from '#core/io/formats/svg/metadata'

import { expectDefined } from '#tests/helpers/assert'

describe('SVG XML parsing', () => {
  test('reads quoted root metadata through the XML parser', () => {
    const svg = `<svg width='120' height="80" viewBox='10 20 300 200'><path d='M0 0'/></svg>`

    expect(parseSVGSize(svg)).toEqual({ width: 120, height: 80 })
    expect(parseSVGViewBox(svg)).toEqual({ x: 10, y: 20, width: 300, height: 200 })
  })

  test('walks nested groups with inherited presentation and transforms', () => {
    const paths = extractPaths(`
      <g fill="#ff0000" transform="translate(4 5)">
        <path d="M0 0L10 0L10 10Z" />
        <g stroke="#0000ff" stroke-width="2" transform="scale(2)">
          <line x1="0" y1="0" x2="4" y2="4" />
        </g>
      </g>
      <defs><path d="M20 20L30 30" /></defs>
    `)

    expect(paths).toHaveLength(2)
    expect(paths[0]).toMatchObject({ fill: '#ff0000', transform: 'translate(4 5)' })
    expect(paths[1]).toMatchObject({
      fill: '#ff0000',
      stroke: '#0000ff',
      strokeWidth: 2,
      transform: 'translate(4 5) scale(2)'
    })
  })

  test('converts parsed element primitives through the shared SVG pipeline', () => {
    const paths = extractPathsFromElements(
      [
        {
          type: 'g',
          props: { transform: 'translate(4 5)' },
          children: [
            { type: 'circle', props: { cx: 10, cy: 10, r: 5 }, children: [] },
            {
              type: 'rect',
              props: { x: 20, y: 20, width: 10, height: 8, rx: 2, strokeWidth: 3 },
              children: []
            }
          ]
        }
      ],
      { fill: '#ff0000' }
    )

    expect(paths).toHaveLength(2)
    expect(paths[0]).toMatchObject({ fill: '#ff0000', transform: 'translate(4 5)' })
    expect(paths[1]).toMatchObject({
      fill: '#ff0000',
      strokeWidth: 3,
      transform: 'translate(4 5)'
    })
    expect(paths.every((path) => path.d.length > 0)).toBe(true)
  })

  test('scales transformed strokes with the conservative non-uniform axis', () => {
    const [uniform] = scalePathInfos(
      extractPaths(
        '<line x1="0" y1="0" x2="4" y2="0" stroke="black" stroke-width="3" transform="scale(2)" />'
      ),
      1,
      1
    )
    const [nonUniform] = scalePathInfos(
      extractPaths(
        '<line x1="0" y1="0" x2="4" y2="0" stroke="black" stroke-width="3" transform="scale(4 2)" />'
      ),
      1,
      1
    )

    expect(uniform?.strokeWidth).toBe(6)
    expect(nonUniform?.strokeWidth).toBe(6)
  })

  test('does not interpret attribute-like path text as markup', () => {
    const paths = extractPaths(`<path d="M0 0L10 10" data-note="fill='red' stroke='blue'"/>`)

    expect(paths).toHaveLength(1)
    expect(paths[0]).toMatchObject({ fill: 'currentColor', stroke: null })
  })

  test('rejects malformed SVG documents', () => {
    expect(extractPaths('<path d="M0 0"><g>')).toEqual([])
    expect(parseSVGViewBox('<svg viewBox="0 0 20 20">')).toBeNull()
  })
})

const straight = { x: 0, y: 0 }

/**
 * Scale a 24-unit path the way inline SVG does. The default, half size, is the clock from #1577:
 * 11.99 becomes 5.995 and rounding lands it on the start, 6. Pass 1 for an icon drawn at its view box.
 */
function scaledNetwork(d: string, scaleX = 12 / 24, scaleY = scaleX): VectorNetwork {
  const path = expectDefined(
    scalePathInfos(
      extractPaths(`<path d="${d}" fill="none" stroke="#000" stroke-width="2.5"/>`),
      scaleX,
      scaleY
    )[0],
    'scaled path'
  )
  return path.vectorNetwork
}

function span(values: number[]): number {
  return Math.max(...values) - Math.min(...values)
}

function segmentBetween(
  network: VectorNetwork,
  start: Vector,
  end: Vector
): VectorSegment | undefined {
  return network.segments.find((segment) => {
    const from = network.vertices[segment.start]
    const to = network.vertices[segment.end]
    return from?.x === start.x && from.y === start.y && to?.x === end.x && to.y === end.y
  })
}

/** A handle at the two-decimal precision scalePathInfos rounds to. */
function roundedHandle(
  network: VectorNetwork,
  segment: VectorSegment,
  side: 'start' | 'end'
): Vector {
  const vertex = expectDefined(
    network.vertices[side === 'start' ? segment.start : segment.end],
    'vertex'
  )
  const tangent = side === 'start' ? segment.tangentStart : segment.tangentEnd
  return {
    x: Math.round((vertex.x + tangent.x) * 100) / 100,
    y: Math.round((vertex.y + tangent.y) * 100) / 100
  }
}

describe('scalePathInfos', () => {
  test('keeps a nearly closed arc when scaling rounds its end onto its start', () => {
    const network = scaledNetwork('M12 3A9 9 0 1 1 11.99 3Z')

    // A collapsed arc is one point. The scaled circle is 9 across.
    expect(network.segments.length).toBeGreaterThan(1)
    expect(span(network.vertices.map((vertex) => vertex.x))).toBe(9)
    expect(span(network.vertices.map((vertex) => vertex.y))).toBe(9)

    const clock = scaledNetwork('M12 3A9 9 0 1 1 11.99 3ZM12 7V12L15 14')
    expect(span(clock.vertices.map((vertex) => vertex.x))).toBe(9)
    expect(span(clock.vertices.map((vertex) => vertex.y))).toBe(9)
    const minute = expectDefined(
      segmentBetween(clock, { x: 6, y: 3.5 }, { x: 6, y: 6 }),
      'minute hand'
    )
    const hour = expectDefined(segmentBetween(clock, { x: 6, y: 6 }, { x: 7.5, y: 7 }), 'hour hand')
    expect(minute.tangentStart).toEqual(straight)
    expect(minute.tangentEnd).toEqual(straight)
    expect(hour.tangentStart).toEqual(straight)
    expect(hour.tangentEnd).toEqual(straight)
  })

  test('keeps the current point as the first control of a smooth curve after an arc', () => {
    const network = scaledNetwork('M12 3A9 9 0 1 1 11.99 3S20 0 24 3')
    const curve = expectDefined(
      network.segments.find((segment) => {
        const end = network.vertices[segment.end]
        return end?.x === 12 && end.y === 1.5
      }),
      'smooth curve'
    )

    // S20 0 24 3 at half scale. The arc's end rounds onto its start, (6, 1.5).
    expect(roundedHandle(network, curve, 'start')).toEqual({ x: 6, y: 1.5 })
    expect(roundedHandle(network, curve, 'end')).toEqual({ x: 10, y: 0 })
    expect(network.vertices[curve.end]).toEqual({ x: 12, y: 1.5 })
  })

  test('keeps a nearly closed arc when identity scaling rounds its end onto its start', () => {
    // 11.996 rounds to 12, the point the arc starts at. Drawn at the view box, the scale is 1.
    const network = scaledNetwork('M12 3A9 9 0 1 1 11.996 3Z', 1)

    expect(network.vertices).toEqual([
      { x: 12, y: 3 },
      { x: 21, y: 12 },
      { x: 12, y: 21 },
      { x: 3, y: 12 }
    ])
    expect(network.segments).toHaveLength(4)
    expect(span(network.vertices.map((vertex) => vertex.x))).toBe(18)
    expect(span(network.vertices.map((vertex) => vertex.y))).toBe(18)
    // A quarter circle's cubic handles are (4/3) * tan(pi/8) times its radius, about 4.97,
    // and perpendicular to the radius from the center.
    const center = { x: 12, y: 12 }
    for (const segment of network.segments) {
      const handles = [
        { vertex: network.vertices[segment.start], handle: segment.tangentStart },
        { vertex: network.vertices[segment.end], handle: segment.tangentEnd }
      ]
      for (const { vertex, handle } of handles) {
        const point = expectDefined(vertex, 'vertex')
        const alongRadius = handle.x * (point.x - center.x) + handle.y * (point.y - center.y)
        expect(Math.hypot(handle.x, handle.y)).toBeCloseTo(4.97, 1)
        expect(alongRadius).toBeCloseTo(0, 1)
      }
    }
  })

  test('keeps a nearly closed relative arc when scaling rounds its end onto its start', () => {
    // -0.004 scales to -0.002, which rounds to 0 and would drop the arc.
    const network = scaledNetwork('M12 3a9 9 0 1 1 -0.004 0Z')

    expect(network.vertices).toEqual([
      { x: 6, y: 1.5 },
      { x: 10.5, y: 6 },
      { x: 6, y: 10.5 },
      { x: 1.5, y: 6 }
    ])
    expect(network.segments).toHaveLength(4)
    expect(span(network.vertices.map((vertex) => vertex.x))).toBe(9)
    expect(span(network.vertices.map((vertex) => vertex.y))).toBe(9)
  })
})
