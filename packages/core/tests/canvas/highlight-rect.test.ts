import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import { SceneGraph } from '@open-pencil/scene-graph'

import { drawNodeHighlightRect } from '#core/canvas/highlight-rect'

const ck = await initCanvasKit()

function pixel(surface: ReturnType<typeof ck.MakeSurface> & object, x: number, y: number) {
  const image = surface.makeImageSnapshot()
  const pixels = expectDefined(
    image.readPixels(x, y, {
      width: 1,
      height: 1,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB
    }),
    'pixel'
  )
  image.delete()
  return [pixels[0], pixels[1], pixels[2], pixels[3]]
}

test('a highlighted layer inside a flipped frame is outlined where it is drawn', () => {
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'page')
  const frame = graph.createNode('FRAME', page.id, {
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    flipX: true,
    fills: []
  })
  const child = graph.createNode('RECTANGLE', frame.id, {
    x: 0,
    y: 40,
    width: 20,
    height: 20,
    fills: []
  })
  const surface = expectDefined(ck.MakeSurface(200, 100), 'surface')
  const renderer = new SkiaRenderer(ck, surface)
  try {
    renderer.pageId = page.id
    renderer.zoom = 1
    const canvas = surface.getCanvas()
    canvas.clear(ck.WHITE)
    expect(drawNodeHighlightRect(renderer, canvas, graph, child.id, { r: 0, g: 0, b: 1 }, 1)).toBe(
      true
    )
    surface.flush()
    // Flipped, the child sits at x 180..200; the outline's top edge runs 5 px above its box.
    expect(pixel(surface, 190, 35)[2]).toBeGreaterThan(200)
    expect(pixel(surface, 190, 35)[0]).toBeLessThan(60)
    expect(pixel(surface, 10, 35)).toEqual([255, 255, 255, 255])
  } finally {
    renderer.destroy()
  }
})
