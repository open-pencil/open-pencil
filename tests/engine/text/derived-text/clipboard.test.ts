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
    const derived = await buildDerivedTextDataV4(
      text,
      fontDigestMap,
      {
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
      },
      blobs
    )

    const derivedTextData = expectDefined(derived, 'derived text data')
    const glyphs = expectDefined(derivedTextData.glyphs, 'glyphs')
    const baselines = expectDefined(derivedTextData.baselines, 'baselines')
    const fontMetaData = expectDefined(derivedTextData.fontMetaData, 'font metadata')
    const offsetMap = expectDefined(
      derivedTextData.logicalIndexToCharacterOffsetMap,
      'character offset map'
    )
    const derivedLines = expectDefined(derivedTextData.derivedLines, 'derived lines')
    const firstGlyph = expectDefined(glyphs[0], 'first glyph')
    const lastGlyph = expectDefined(glyphs[4], 'last glyph')
    const baseline = expectDefined(baselines[0], 'first baseline')
    const line = expectDefined(derivedLines[0], 'first derived line')

    expect(fontMetaData.length).toBeGreaterThan(0)
    expect(fontMetaData[0].key.style).toBe('Regular')
    expect(glyphs.length).toBeGreaterThan(0)
    expect(baselines.length).toBeGreaterThan(0)
    expect(offsetMap.length).toBe(text.text.length + 1)
    expect(offsetMap[5]).toBe(42)
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

  test('preserves shaped multiline baselines for Figma text editing', async () => {
    await initCodec()

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      name: 'Wrapped',
      text: 'Analytics Overview',
      width: 360,
      height: 136,
      fontFamily: 'Missing Preview Font',
      fontSize: 56,
      fontWeight: 700
    })

    const derived = expectDefined(
      await buildDerivedTextDataV4(
        text,
        await buildFontDigestMap(graph),
        {
          lineHeight: 68,
          lineAscent: 54,
          lineWidth: 272,
          baseline: 54.36,
          baselines: [
            {
              firstCharacter: 0,
              endCharacter: 10,
              position: { x: 0, y: 54.36 },
              width: 271.58,
              lineY: 0,
              lineHeight: 68,
              lineAscent: 54
            },
            {
              firstCharacter: 10,
              endCharacter: 18,
              position: { x: 0, y: 122.36 },
              width: 261.9,
              lineY: 68,
              lineHeight: 68,
              lineAscent: 54
            }
          ],
          glyphs: [
            { firstCharacter: 0, x: 0, y: 54.36, advance: 42 },
            { firstCharacter: 10, x: 0, y: 122.36, advance: 44 }
          ],
          logicalIndexToCharacterOffsetMap: Array.from({ length: 19 }, () => 0)
        },
        undefined
      ),
      'derived text'
    )
    const baselines = expectDefined(derived.baselines, 'baselines')

    expect(baselines).toHaveLength(2)
    expect(baselines[0].endCharacter).toBe(10)
    expect(baselines[1].firstCharacter).toBe(10)
    expect(baselines[1].position.y).toBe(122.36)
    expect(derived.layoutSize).toEqual({ x: 360, y: 136 })
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
    const derived = expectDefined(
      await buildDerivedTextDataV4(text, fontDigestMap, null, blobs),
      'derived text'
    )

    const fontMetaData = expectDefined(derived.fontMetaData, 'font metadata')
    const glyphs = expectDefined(derived.glyphs, 'glyphs')
    const offsetMap = expectDefined(
      derived.logicalIndexToCharacterOffsetMap,
      'character offset map'
    )

    expect(fontMetaData[0].key.style).toBe('Semi Bold')
    expect(glyphs[0].commandsBlob).toBe(0)
    expect(blobs[0].length).toBeGreaterThan(0)
    expect(glyphs[1].position.x).toBeGreaterThan(0)
    expect(glyphs[1].advance).toBeGreaterThan(0)
    expect(offsetMap[1]).toBeGreaterThan(0)
  })
})
