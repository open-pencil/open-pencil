import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SkiaRenderer } from '#core/canvas'
import { initCanvasKit } from '#core/io/formats/raster/headless'
import { fontManager } from '#core/text/fonts'

const ck = await initCanvasKit()

const renderer = () => new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1), 'surface'))

test('destroying a renderer that never loaded fonts leaves the others their fonts', async () => {
  const drawing = renderer()
  await drawing.loadFonts()
  const provider = expectDefined(drawing.getFontProvider(), 'font provider')
  try {
    renderer().destroy()
    expect(fontManager.provider()).toBe(provider)
  } finally {
    drawing.destroy()
  }
  expect(fontManager.provider()).not.toBe(provider)
})
