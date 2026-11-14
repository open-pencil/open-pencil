import { expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

// Figma desktop (2026-11-14): a 100×100 rectangle with corners 90, 30, 0, 60 draws its top-right
// corner at 25, the top edge's share, where one factor for the whole box would leave it at 20.
test('the canvas fits oversized corners per edge, as Figma draws them', async () => {
  const ck = await getCanvasKit()
  const surface = expectDefined(ck.MakeSurface(100, 100), 'surface')
  const renderer = new SkiaRenderer(ck, surface)
  const graph = new SceneGraph()
  const node = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
    width: 100,
    height: 100,
    independentCorners: true,
    topLeftRadius: 90,
    topRightRadius: 30,
    bottomLeftRadius: 60,
    fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
  })
  try {
    const canvas = surface.getCanvas()
    canvas.clear(ck.TRANSPARENT)
    renderer.renderShape(canvas, node, graph)
    surface.flush()
    const alpha = (x: number, y: number) =>
      expectDefined(
        surface.makeImageSnapshot().readPixels(x, y, {
          width: 1,
          height: 1,
          colorType: ck.ColorType.RGBA_8888,
          alphaType: ck.AlphaType.Unpremul,
          colorSpace: ck.ColorSpace.SRGB
        }),
        'pixel'
      )[3]
    // Outside a 25px corner centred at 75,25, inside a 20px one centred at 80,20.
    expect(alpha(93, 5)).toBe(0)
    expect(alpha(70, 30)).toBe(255)
  } finally {
    renderer.destroy()
  }
})
