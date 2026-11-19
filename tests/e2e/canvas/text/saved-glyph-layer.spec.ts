import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { savedGlyphLayerDriver } from '#tests/helpers/canvas/saved-glyph-layer/driver'
import { SAVED_GLYPH_LAYER_COPIES } from '#tests/helpers/canvas/saved-glyph-layer/scene'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')
const scene = savedGlyphLayerDriver(() => editor.page)

test('a trimmed text drawn from its saved glyphs keeps them past its box at half opacity', async () => {
  await scene.show()
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  for (const copy of SAVED_GLYPH_LAYER_COPIES) {
    // A first frame may be drawn before the text settles; the settled frame must keep the ink.
    await expect.poll(() => scene.keepsInkPastBox(copy.x)).toBe(true)
  }
  // The second copy draws through its opacity layer, lighter than the opaque one.
  const [opaque, half] = SAVED_GLYPH_LAYER_COPIES
  expect(await scene.lightness(half.x)).toBeGreaterThan(await scene.lightness(opaque.x))
})
