import { describe, expect, test } from 'bun:test'

import {
  fontManager,
  SceneGraph,
  buildFontDigestMap,
  buildDerivedTextDataV4,
  initCodec
} from '@open-pencil/core'

import { expectDefined } from '#tests/helpers/assert'

describe('clipboard derived text export', () => {
  test('builds richer v4 derivedTextData from shaped text + glyph outlines', async () => {
    await initCodec()

    const font = expectDefined(
      await fontManager.fetchBundledFont('/Inter-Regular.ttf'),
      'bundled Inter font'
    )
    fontManager.markLoaded('Inter', 'Regular', font)

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
    const blobs: Uint8Array[] = []
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
    }, blobs)

    const derivedTextData = expectDefined(derived, 'derived text data')
    const firstGlyph = expectDefined(derivedTextData.glyphs[0], 'first glyph')
    const lastGlyph = expectDefined(derivedTextData.glyphs[4], 'last glyph')
    const baseline = expectDefined(derivedTextData.baselines[0], 'first baseline')
    const line = expectDefined(derivedTextData.derivedLines[0], 'first derived line')

    expect(derivedTextData.fontMetaData.length).toBeGreaterThan(0)
    expect(derivedTextData.fontMetaData[0].key.style).toBe('Regular')
    expect(derivedTextData.glyphs.length).toBeGreaterThan(0)
    expect(derivedTextData.baselines.length).toBeGreaterThan(0)
    expect(derivedTextData.logicalIndexToCharacterOffsetMap.length).toBe(text.text.length + 1)
    expect(derivedTextData.logicalIndexToCharacterOffsetMap[5]).toBe(42)
    expect(line.directionality).toBe('LTR')
    expect(derivedTextData.truncationStartIndex).toBe(-1)
    expect(derivedTextData.truncatedHeight).toBe(-1)
    expect(firstGlyph.commandsBlob).toBe(0)
    expect(blobs[0].length).toBeGreaterThan(0)
    expect(firstGlyph.position.x).toBe(0)
    expect(lastGlyph.position.x).toBe(32)
    expect(baseline.lineHeight).toBe(20)
    expect(baseline.lineAscent).toBe(15)
    expect(baseline.width).toBe(42)
  })

  test('uses Figma font style names in metadata', async () => {
    await initCodec()

    const font = expectDefined(
      await fontManager.fetchBundledFont('/Inter-SemiBold.ttf'),
      'bundled Inter font'
    )
    fontManager.markLoaded('Inter', 'SemiBold', font)

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      text: 'Title',
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: 600
    })

    const fontDigestMap = await buildFontDigestMap(graph)
    const blobs: Uint8Array[] = []
    const derived = expectDefined(await buildDerivedTextDataV4(text, fontDigestMap, null, blobs), 'derived text')

    expect(derived.fontMetaData[0].key.style).toBe('Semi Bold')
    expect(derived.glyphs[0].commandsBlob).toBe(0)
    expect(blobs[0].length).toBeGreaterThan(0)
    expect(derived.glyphs[1].position.x).toBeGreaterThan(0)
    expect(derived.glyphs[1].advance).toBeGreaterThan(0)
    expect(derived.logicalIndexToCharacterOffsetMap[1]).toBeGreaterThan(0)
  })
})
