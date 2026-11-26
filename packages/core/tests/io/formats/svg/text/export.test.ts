import { describe, expect, test } from 'bun:test'

import { solid, svgOf } from '#core-tests/io/formats/svg/export/helpers'

import type { Fill, SceneGraph } from '@open-pencil/scene-graph'

const BLACK = solid(0, 0, 0, 1, 1)

const RED_TO_BLUE: Fill = {
  ...BLACK,
  type: 'GRADIENT_LINEAR',
  gradientStops: [
    { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
    { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
  ],
  gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
}

/** "Ab" in a 40 × 20 layer of `fills`, its "b" in `rangeFills` of its own. */
function rangedText(fills: Fill[], rangeFills: Fill[]) {
  return (graph: SceneGraph, pageId: string) => [
    graph.createNode('TEXT', pageId, {
      text: 'Ab',
      width: 40,
      height: 20,
      fills,
      styleRuns: [{ start: 1, length: 1, style: { fills: rangeFills } }]
    }).id
  ]
}

describe('text ranges with fills of their own exported to SVG', () => {
  test('a gradient on a range spans the layer, in its own units', () => {
    const svg = svgOf(rangedText([BLACK], [RED_TO_BLUE]))
    expect(svg).toMatch(/<tspan fill="url\(#(grad\d*)\)">b<\/tspan>/)
    expect(svg).toContain(
      'gradientUnits="userSpaceOnUse" gradientTransform="matrix(40 0 0 20 0 0)"'
    )
  })

  test('a range whose fills are empty or hidden is not painted', () => {
    expect(svgOf(rangedText([BLACK], []))).toContain('<tspan fill="none">b</tspan>')
    expect(svgOf(rangedText([BLACK], [{ ...BLACK, visible: false }]))).toContain(
      '<tspan fill="none">b</tspan>'
    )
  })

  test("a text's own gradient spans its layer, not only its characters", () => {
    const svg = svgOf((graph, pageId) => [
      graph.createNode('TEXT', pageId, { text: 'Ab', width: 40, height: 20, fills: [RED_TO_BLUE] })
        .id
    ])
    expect(svg).toContain(
      'gradientUnits="userSpaceOnUse" gradientTransform="matrix(40 0 0 20 0 0)"'
    )
  })
})
