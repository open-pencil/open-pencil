import { beforeAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SceneGraph } from '@open-pencil/scene-graph'

import { SkiaRenderer } from '#core/canvas/renderer'
import { getCanvasKit } from '#core/canvaskit'
import { renderNodesToImage } from '#core/io/formats/raster/render'

let ck: Awaited<ReturnType<typeof getCanvasKit>>

beforeAll(async () => {
  ck = await getCanvasKit()
})

describe('component set rendering', () => {
  test('a set without a stroke draws no editing border in the scene', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const set = graph.createNode('COMPONENT_SET', page.id, { width: 40, height: 40, fills: [] })
    const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
    const renderer = new SkiaRenderer(ck, surface)

    try {
      const png = expectDefined(
        renderNodesToImage(ck, renderer, graph, page.id, [set.id], { scale: 1, format: 'PNG' }),
        'png'
      )
      const image = expectDefined(ck.MakeImageFromEncoded(png), 'image')
      const pixels = expectDefined(
        image.readPixels(0, 0, {
          alphaType: ck.AlphaType.Unpremul,
          colorType: ck.ColorType.RGBA_8888,
          colorSpace: ck.ColorSpace.SRGB,
          width: image.width(),
          height: image.height()
        }),
        'pixels'
      )
      // The border is editor chrome, drawn by the overlay pass at the live zoom.
      expect(Math.max(...pixels.filter((_, index) => index % 4 === 3))).toBe(0)
      image.delete()
    } finally {
      surface.delete()
    }
  })
})
