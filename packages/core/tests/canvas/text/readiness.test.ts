import { beforeAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createDefaultNode } from '@open-pencil/scene-graph/node-defaults'

import { nodeFontReadiness } from '#core/canvas/text'
import { getCanvasKit } from '#core/canvaskit'
import { fontManager } from '#core/text/font/manager'

/**
 * A character no font has, once no fallback is left for it, shows as the font's missing glyph
 * and leaves the rest of the text drawn; it used to hide the whole text.
 */
describe('text readiness with characters no font has', () => {
  beforeAll(async () => {
    const inter = expectDefined(
      await fontManager.fetchBundledFont('/InterVariable.ttf'),
      'bundled Inter font'
    )
    await fontManager.markLoaded('Inter', 'Regular', inter)
  })

  test('draws the text with the fonts it has', async () => {
    const ck = await getCanvasKit()
    const fontProvider = ck.TypefaceFontProvider.Make()
    fontManager.attachProvider(ck, fontProvider)
    const node = createDefaultNode(() => 'tamil-text', 'TEXT', {
      text: 'Tamil \u0b86 ok',
      fontFamily: 'Inter',
      fontSize: 24,
      width: 300,
      height: 40
    })
    expect(nodeFontReadiness({ ck, fontProvider, fontsLoaded: true }, node)).toBe('substituted')
  })
})
