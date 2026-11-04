import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'
import { savedGlyphAntialiasDriver } from '#tests/helpers/canvas/saved-glyph-antialias-driver'

test.use({ deviceScaleFactor: 1 })

test('text drawn from saved glyphs is antialiased at every size and zoom', async ({ page }) => {
  test.setTimeout(30_000)
  const canvas = new CanvasHelper(page)
  const scene = savedGlyphAntialiasDriver(() => page)
  await page.goto('/?test&no-chrome&no-rulers')
  await canvas.waitForInit()

  expect(await scene.show()).toBe(scene.samples)
  const actual = await scene.capture(1, 180, 140)
  const zoomed = await scene.capture(4, 640, 560)
  // The snapshot comparison skips antialiased pixels, so it cannot tell aliased edges from smooth.
  for (const share of [
    ...(await scene.edgeShares(actual, 1)),
    ...(await scene.edgeShares(zoomed, 4))
  ]) {
    expect(share).toBeGreaterThan(0.05)
  }
  expect(actual).toMatchSnapshot('saved-glyph-antialias.png')
  expect(zoomed).toMatchSnapshot('saved-glyph-antialias-zoomed.png')
  canvas.assertNoErrors()
})
