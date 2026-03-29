import { describe, expect, test } from 'bun:test'

import {
  fetchBundledFont,
  markFontLoaded,
  SceneGraph,
  buildFontDigestMap,
  buildDerivedTextDataV4,
  initCodec
} from '@open-pencil/core'

describe('clipboard derived text export', () => {
  test('builds richer v4 derivedTextData from shaped text + glyph outlines', async () => {
    await initCodec()

    const font = await fetchBundledFont('/Inter-Regular.ttf')
    expect(font).toBeTruthy()
    if (!font) return
    markFontLoaded('Inter', 'Regular', font)

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      name: 'Hello',
      text: 'Hello',
      width: 120,
      height: 24,
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: 400
    })

    const fontDigestMap = await buildFontDigestMap(graph)
    const derived = await buildDerivedTextDataV4(text, fontDigestMap, {
      lineHeight: 20,
      lineAscent: 15,
      lineWidth: 42,
      baseline: 16,
      glyphs: [
        { firstCharacter: 0, x: 0, y: 16, advance: 8 },
        { firstCharacter: 1, x: 8, y: 16, advance: 8 },
        { firstCharacter: 2, x: 16, y: 16, advance: 8 },
        { firstCharacter: 3, x: 24, y: 16, advance: 8 },
        { firstCharacter: 4, x: 32, y: 16, advance: 10 }
      ],
      logicalIndexToCharacterOffsetMap: [0, 8, 16, 24, 32, 42]
    })

    expect(derived?.fontMetaData?.length).toBeGreaterThan(0)
    expect(derived?.glyphs?.length).toBeGreaterThan(0)
    expect(derived?.baselines?.length).toBeGreaterThan(0)
    expect(derived?.logicalIndexToCharacterOffsetMap?.length).toBe(text.text.length + 1)
    expect(derived?.logicalIndexToCharacterOffsetMap?.[5]).toBe(42)
    expect(derived?.derivedLines?.[0]?.directionality).toBe('LTR')
    expect(derived?.truncationStartIndex).toBe(-1)
    expect(derived?.truncatedHeight).toBe(-1)
    expect(derived?.glyphs?.[0]?.commands.length).toBeGreaterThan(0)
    expect(derived?.glyphs?.[0]?.position.x).toBe(0)
    expect(derived?.glyphs?.[4]?.position.x).toBe(32)
    expect(derived?.baselines?.[0]?.lineHeight).toBe(20)
    expect(derived?.baselines?.[0]?.lineAscent).toBe(15)
    expect(derived?.baselines?.[0]?.width).toBe(42)
  })
})
