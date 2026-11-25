import { expect, test } from 'bun:test'

import type { Fill } from '@open-pencil/scene-graph'

import { BLACK_STROKE, rects, solid, svgOf } from './helpers'

const SHADER: Fill = {
  type: 'CUSTOM',
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  customEffectId: { key: 'abc', version: 'v1' }
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
