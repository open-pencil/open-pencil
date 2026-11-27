import { describe, expect, test } from 'bun:test'

import { renderNodesToPPTX } from '@open-pencil/core/io'
import type { Fill, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import {
  makeGraph,
  pageId,
  slideXML,
  solidFill,
  solidStroke,
  stubRasterize,
  unzipPPTX
} from './helpers'

const SHADER: Fill = {
  type: 'CUSTOM',
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  customEffectAssetRef: { key: 'abc', version: 'v1' }
}
const SHADER_STROKE: Stroke = { ...SHADER, weight: 2, align: 'CENTER' }
const RED = solidFill(1, 0, 0)
const BLUE = solidFill(0, 0, 1)
const BLUE_STROKE = solidStroke(0, 0, 1)
const GRADIENT_STROKE: Stroke = {
  ...BLUE_STROKE,
  type: 'GRADIENT_LINEAR',
  gradientStops: [
    { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
    { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
  ]
}

interface Slide {
  root?: Partial<SceneNode>
  layer: Partial<SceneNode> & { type: SceneNode['type'] }
}

async function slide({ root = {}, layer: { type, ...layer } }: Slide) {
  const graph = makeGraph()
  const frame = graph.createNode('FRAME', pageId(graph), {
    name: 'Slide',
    width: 1280,
    height: 720,
    ...root
  })
  graph.createNode(type, frame.id, {
    name: 'Layer',
    x: 10,
    y: 10,
    width: 200,
    height: 40,
    ...layer
  })
  const data = expectDefined(
    await renderNodesToPPTX(graph, pageId(graph), [frame.id], { rasterize: stubRasterize })
  )
  const files = unzipPPTX(data)
  return {
    xml: slideXML(files, 1),
    pictures: Object.keys(files).filter((name) => name.includes('media')).length
  }
}

const shape = (layer: Partial<SceneNode>): Slide => ({ layer: { type: 'RECTANGLE', ...layer } })
const text = (layer: Partial<SceneNode>): Slide => ({
  layer: { type: 'TEXT', text: 'Hi', ...layer }
})
const rooted = (root: Partial<SceneNode>): Slide => ({
  root,
  layer: { type: 'RECTANGLE', fills: [RED] }
})

const CASES: [string, Slide, Slide][] = [
  ['shape fills', shape({ fills: [SHADER, RED] }), shape({ fills: [RED] })],
  [
    'shape strokes',
    shape({ fills: [RED], strokes: [SHADER_STROKE, BLUE_STROKE] }),
    shape({ fills: [RED], strokes: [BLUE_STROKE] })
  ],
  ['text fills', text({ fills: [SHADER, RED] }), text({ fills: [RED] })],
  [
    'text run fills',
    text({ fills: [RED], styleRuns: [{ start: 0, length: 1, style: { fills: [SHADER, BLUE] } }] }),
    text({ fills: [RED], styleRuns: [{ start: 0, length: 1, style: { fills: [BLUE] } }] })
  ],
  [
    'text strokes',
    text({ fills: [RED], strokes: [SHADER_STROKE] }),
    text({ fills: [RED], strokes: [] })
  ],
  ['slide fills', rooted({ fills: [SHADER, RED] }), rooted({ fills: [RED] })],
  [
    'slide strokes',
    rooted({ fills: [RED], strokes: [SHADER_STROKE, BLUE_STROKE] }),
    rooted({ fills: [RED], strokes: [BLUE_STROKE] })
  ],
  [
    'slide background',
    rooted({ fills: [RED], strokes: [SHADER_STROKE] }),
    rooted({ fills: [RED], strokes: [] })
  ]
]

describe('Figma shader paints in PPTX', () => {
  for (const [name, withShader, without] of CASES) {
    test(`${name} export as they do without the shader paint`, async () => {
      expect(await slide(withShader)).toEqual(await slide(without))
    })
  }

  for (const [owner, layer] of [
    ['shape', shape],
    ['slide', rooted]
  ] as const) {
    for (const strokes of [[SHADER_STROKE, GRADIENT_STROKE], [GRADIENT_STROKE]]) {
      const paints = strokes.map((stroke) => stroke.type).join(' and ')
      test(`a ${owner} with a ${paints} stroke draws as a picture`, async () => {
        const { xml } = await slide(layer({ fills: [RED], strokes }))
        expect(xml).toContain('<p:pic>')
      })
    }
  }
})
