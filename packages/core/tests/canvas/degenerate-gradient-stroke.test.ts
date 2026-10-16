import { afterAll, expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'

import { expectDefined } from '#core-tests/helpers/assert'

import { SceneGraph } from '@open-pencil/scene-graph'

import { SkiaRenderer } from '#core/canvas/renderer'
import { getCanvasKit } from '#core/canvaskit'
import { renderNodesToImage } from '#core/io/formats/raster/render'

const canvasKitModule = import.meta.resolve('canvaskit-wasm')
const ck = await getCanvasKit({
  locateFile: (file) => fileURLToPath(new URL(file, canvasKitModule))
})
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

test('a zero-height line with a gradient stroke does not abort rendering', () => {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const frame = graph.createNode('FRAME', pageId, {
    width: 240,
    height: 40,
    fills: [],
    clipsContent: false
  })
  const line = graph.createNode('LINE', frame.id, {
    x: 20,
    y: 20,
    width: 200,
    height: 0,
    fills: [],
    strokes: [
      {
        type: 'GRADIENT_LINEAR',
        color: { r: 0, g: 0, b: 0, a: 1 },
        gradientStops: [
          { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
          { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
        ],
        gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        weight: 4,
        opacity: 1,
        visible: true,
        align: 'CENTER'
      }
    ]
  })

  expect(line.height).toBe(0)
  const png = renderNodesToImage(ck, renderer, graph, pageId, [frame.id], {
    scale: 1,
    format: 'PNG',
    trimTransparent: false
  })

  expect(expectDefined(png, 'rendered PNG').byteLength).toBeGreaterThan(0)
})
