import { afterAll, describe, expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { convertFills, convertStrokes } from '@open-pencil/fig/node-change'
import type { Paint } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

const SIZE = 4

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(SIZE, SIZE), 'surface'))
afterAll(() => renderer.destroy())

const SOLID: Paint = { type: 'SOLID', color: { r: 0.2, g: 0.6, b: 0.4, a: 1 }, opacity: 1 }

const SHADER: Paint = {
  type: 'CUSTOM',
  opacity: 0.5,
  visible: true,
  blendMode: 'NORMAL',
  customEffectId: { assetRef: { key: 'abc', version: 'v1' } },
  componentPropAssignments: [
    { defID: { sessionID: 1, localID: 2 }, varValue: { value: { floatValue: 0.3 } } }
  ]
}

const SOLID_PIXEL = [51, 153, 102, 255]
const TRANSPARENT_PIXEL = [0, 0, 0, 0]

function renderedPixels(layer: Partial<SceneNode>): number[][] {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  graph.createNode('RECTANGLE', page.id, { width: SIZE, height: SIZE, ...layer })
  renderer.pageId = page.id
  const canvas = renderer.surface.getCanvas()
  canvas.clear(ck.TRANSPARENT)
  renderer.renderSceneToCanvas(canvas, graph, page.id)
  renderer.surface.flush()
  const image = renderer.surface.makeImageSnapshot()
  try {
    const pixels = expectDefined(
      image.readPixels(0, 0, {
        width: SIZE,
        height: SIZE,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      }),
      'pixels'
    )
    return Array.from({ length: SIZE * SIZE }, (_, index) =>
      Array.from(pixels.subarray(index * 4, index * 4 + 4))
    )
  } finally {
    image.delete()
  }
}

describe('Figma shader paints', () => {
  test('a shader paint over a solid one leaves the solid colour as it is', () => {
    const pixels = renderedPixels({ fills: convertFills([SOLID, SHADER]) })
    expect(pixels).toEqual(Array.from({ length: SIZE * SIZE }, () => SOLID_PIXEL))
  })

  test('a layer whose only paint is a shader draws nothing', () => {
    const pixels = renderedPixels({ fills: convertFills([SHADER]) })
    expect(pixels).toEqual(Array.from({ length: SIZE * SIZE }, () => TRANSPARENT_PIXEL))
  })

  test('a shader stroke draws nothing', () => {
    const strokes = convertStrokes([{ ...SHADER, opacity: 1 }], SIZE, 'INSIDE')
    const pixels = renderedPixels({ strokes })
    expect(pixels).toEqual(Array.from({ length: SIZE * SIZE }, () => TRANSPARENT_PIXEL))
  })
})
