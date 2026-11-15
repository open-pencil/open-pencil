import { afterAll, expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { renderNodesToImage } from '@open-pencil/core/io/formats/raster'
import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1), 'surface'))

afterAll(() => renderer.destroy())

const red = { type: 'SOLID' as const, color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }

/** A 1000px tall red list under an 80px ellipse mask, as a list scrolled past its window. */
function scrolledList() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const group = graph.createNode('GROUP', page, { x: 0, y: -500, width: 100, height: 1000 })
  graph.createNode('ELLIPSE', group.id, {
    x: 10,
    y: 510,
    width: 80,
    height: 80,
    fills: [red],
    isMask: true,
    maskType: 'ALPHA'
  })
  graph.createNode('RECTANGLE', group.id, { width: 100, height: 1000, fills: [red] })
  return { graph, page, group: group.id }
}

test('a masked PNG export is as big as its mask and follows the mask shape', () => {
  const { graph, page, group } = scrolledList()
  const png = expectDefined(
    renderNodesToImage(ck, renderer, graph, page, [group], { scale: 1, format: 'PNG' }),
    'png'
  )
  const image = expectDefined(ck.MakeImageFromEncoded(png), 'image')
  try {
    expect([image.width(), image.height()]).toEqual([80, 80])
    const pixels = expectDefined(
      image.readPixels(0, 0, {
        width: 80,
        height: 80,
        alphaType: ck.AlphaType.Unpremul,
        colorType: ck.ColorType.RGBA_8888,
        colorSpace: ck.ColorSpace.SRGB
      }),
      'pixels'
    )
    const pixel = (x: number, y: number) => [
      ...pixels.subarray((y * 80 + x) * 4, (y * 80 + x + 1) * 4)
    ]
    expect(pixel(40, 40)).toEqual([255, 0, 0, 255])
    expect(pixel(40, 2)).toEqual([255, 0, 0, 255])
    expect(pixel(2, 2)[3]).toBe(0)
    expect(pixel(77, 77)[3]).toBe(0)
  } finally {
    image.delete()
  }
})
