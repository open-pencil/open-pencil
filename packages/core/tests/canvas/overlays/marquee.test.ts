import { expect, test } from 'bun:test'

import { expectDefined } from '@open-pencil/test-support/assert'
import { SkiaRenderer } from '#core/canvas'
import { getCanvasKit } from '#core/canvaskit'
import { drawMarquee } from '#core/canvas/overlays/feedback'

const ck = await getCanvasKit()

const SURFACE = 600

/**
 * The width of the marquee's border in screen pixels: the opaque selection blue at the edge of
 * the translucent fill.
 *
 * The marquee is drawn in screen pixels, so its border is a screen width — like Figma's. It must
 * not depend on what the selection overlay left on the shared selection paint: the single
 * selection path leaves `1/zoom` there, a world width meant for the scaled canvas, which would
 * draw the border that many pixels wide (20px at 5% zoom) and would change with the selection,
 * since the multi selection path leaves 1 behind.
 */
function marqueeBorderWidth(zoom: number, leftoverStrokeWidth?: number): number {
  const surface = expectDefined(ck.MakeSurface(SURFACE, SURFACE), 'surface')
  const renderer = new SkiaRenderer(ck, surface)
  try {
    renderer.zoom = zoom
    // Half a pixel off, so the border falls on whole pixels instead of straddling two.
    renderer.panX = 0.5
    renderer.panY = 0.5
    if (leftoverStrokeWidth !== undefined) {
      renderer.selectionPaint.setStrokeWidth(leftoverStrokeWidth)
    }
    const canvas = surface.getCanvas()
    canvas.clear(ck.TRANSPARENT)
    // A world box whose drawn box keeps an interior even at a low zoom.
    drawMarquee(renderer, canvas, { x: 0, y: 0, width: 10000, height: 10000 })
    const image = surface.makeImageSnapshot()
    try {
      const pixels = image.readPixels(0, 0, {
        alphaType: ck.AlphaType.Unpremul,
        colorType: ck.ColorType.RGBA_8888,
        colorSpace: ck.ColorSpace.SRGB,
        width: SURFACE,
        height: SURFACE
      })
      if (!(pixels instanceof Uint8Array)) throw new Error('画布像素读不出来')
      const alphaAt = (x: number, y: number) => pixels[(y * SURFACE + x) * 4 + 3]
      // The middle row crosses the left border and then the fill.
      const row = SURFACE / 2
      let x = 0
      while (x < SURFACE && alphaAt(x, row) < 128) x++
      const start = x
      while (x < SURFACE && alphaAt(x, row) >= 128) x++
      return x - start
    } finally {
      image.delete()
    }
  } finally {
    renderer.destroy()
  }
}

test('the marquee border is one screen pixel at any zoom', () => {
  // What the single selection path leaves on the shared paint: 1/zoom.
  expect(marqueeBorderWidth(1, 1)).toBeLessThanOrEqual(2)
  expect(marqueeBorderWidth(0.05, 1 / 0.05)).toBeLessThanOrEqual(2)
})

test('the marquee border is the same whatever the selection left behind', () => {
  // One layer selected leaves 1/zoom, several leave 1: the border must not follow.
  expect(marqueeBorderWidth(0.05, 1 / 0.05)).toBe(marqueeBorderWidth(0.05, 1))
})
