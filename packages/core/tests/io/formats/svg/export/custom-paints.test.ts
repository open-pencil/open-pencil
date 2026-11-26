import { expect, test } from 'bun:test'

import type { Fill, Stroke, VectorNetwork } from '@open-pencil/scene-graph'

import { BLACK_STROKE, rects, solid, svgOf } from './helpers'

const SHADER: Fill = {
  type: 'CUSTOM',
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  customEffectAssetRef: { key: 'abc', version: 'v1' }
}

test('a Figma shader paint exports nothing, as fill or as stroke', () => {
  const svg = svgOf(
    (graph, pageId) => [
      graph.createNode('RECTANGLE', pageId, {
        width: 40,
        height: 40,
        fills: [SHADER, solid(1, 0, 0, 1, 1)],
        strokes: [
          { ...BLACK_STROKE, ...SHADER },
          { ...BLACK_STROKE, color: { r: 0, g: 0, b: 1, a: 1 } }
        ]
      }).id
    ],
    { colorSpace: 'srgb' }
  )
  expect(rects(svg)).toEqual([
    '<rect width="40" height="40" fill="#FF0000" stroke="#0000FF" stroke-width="2"/>'
  ])
})

test('a text whose only fill is a Figma shader exports no visible glyphs', () => {
  const svg = svgOf((graph, pageId) => [
    graph.createNode('TEXT', pageId, { text: 'Hi', width: 40, height: 20, fills: [SHADER] }).id
  ])
  expect(svg).toMatch(/<text [^>]*fill="none"/)
})

test('a text whose first drawn fill SVG cannot write keeps its glyphs in the default fill', () => {
  const noise: Fill = { ...solid(1, 0, 0, 1, 1), type: 'NOISE' }
  const svg = svgOf((graph, pageId) => [
    graph.createNode('TEXT', pageId, { text: 'Hi', width: 40, height: 20, fills: [noise] }).id
  ])
  expect(svg).toMatch(/<text (?![^>]*fill=)[^>]*>Hi<\/text>/)
})

test('a shape takes its fill opacity from its first drawn fill', () => {
  const svg = svgOf(
    (graph, pageId) => [
      graph.createNode('RECTANGLE', pageId, {
        width: 40,
        height: 40,
        fills: [{ ...SHADER, opacity: 0.5 }, solid(1, 0, 0, 1, 0.25)]
      }).id
    ],
    { colorSpace: 'srgb' }
  )
  expect(rects(svg)).toEqual(['<rect width="40" height="40" fill="#FF0000" fill-opacity="0.25"/>'])
})

const BLUE_LINE: Stroke = { ...BLACK_STROKE, color: { r: 0, g: 0, b: 1, a: 1 }, dashPattern: [] }
const SHADER_LINE: Stroke = { ...BLUE_LINE, ...SHADER, weight: 12, dashPattern: [4, 4] }
const STRAIGHT = { x: 0, y: 0 }
const OPEN_PATH: VectorNetwork = {
  vertices: [
    { x: 0, y: 0 },
    { x: 40, y: 20 }
  ],
  segments: [{ start: 0, end: 1, tangentStart: STRAIGHT, tangentEnd: STRAIGHT }],
  regions: []
}

function drawnShapes(type: 'LINE' | 'VECTOR', strokes: Stroke[]): string {
  const svg = svgOf(
    (graph, pageId) => [
      graph.createNode(type, pageId, {
        width: 40,
        height: type === 'LINE' ? 0 : 20,
        strokeCap: 'TRIANGLE_FILLED',
        strokes,
        ...(type === 'VECTOR' ? { vectorNetwork: OPEN_PATH } : {})
      }).id
    ],
    { colorSpace: 'srgb' }
  )
  return svg.slice(svg.indexOf('<g'), svg.indexOf('</g>')).replace(/^<g[^>]*>/, '')
}

for (const type of ['LINE', 'VECTOR'] as const) {
  test(`a ${type} and its arrow heads draw by the first drawn stroke, past a shader stroke`, () => {
    expect(drawnShapes(type, [SHADER_LINE, BLUE_LINE])).toBe(drawnShapes(type, [BLUE_LINE]))
  })
}
