import { afterAll, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { SkiaRenderer } from '#core/canvas/renderer'
import { drawShapeThroughNodePicture } from '#core/canvas/renderer/node-pictures'
import { getCanvasKit } from '#core/canvaskit'

const SIZE = 100

const ck = await getCanvasKit()
const surface = expectDefined(ck.MakeSurface(SIZE, SIZE), 'surface')
const renderer = new SkiaRenderer(ck, surface)
afterAll(() => renderer.destroy())

// Figma 126 lets a bottom-aligned text's lines run up past its box, with their shadow.
test('a node picture keeps the lines above a text box that lies off the canvas', () => {
  const graph = new SceneGraph()
  const text = graph.createNode('TEXT', graph.getPages()[0].id, {
    width: 100,
    height: 12,
    text: 'abc',
    textAutoResize: 'NONE',
    textAlignVertical: 'BOTTOM',
    derivedTextHeight: 60,
    effects: [
      {
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 1 },
        offset: { x: 0, y: 0 },
        radius: 0,
        spread: 0,
        visible: true,
        blendMode: 'NORMAL'
      }
    ]
  })
  const canvas = surface.getCanvas()
  const paint = new ck.Paint()
  paint.setColor(ck.BLACK)
  canvas.clear(ck.TRANSPARENT)
  canvas.save()
  canvas.translate(0, SIZE + 20)

  drawShapeThroughNodePicture(renderer, canvas, text, (target) => {
    target.drawRect(ck.LTRBRect(0, -45, 20, -35), paint)
    target.drawRect(ck.LTRBRect(30, -45, 50, -35), paint)
  })

  canvas.restore()
  surface.flush()
  const pixels = expectDefined(
    canvas.readPixels(0, 0, {
      alphaType: ck.AlphaType.Unpremul,
      colorType: ck.ColorType.RGBA_8888,
      colorSpace: ck.ColorSpace.SRGB,
      width: SIZE,
      height: SIZE
    }),
    'pixels'
  )
  paint.delete()
  expect(pixels[(80 * SIZE + 10) * 4 + 3]).toBe(255)
})
