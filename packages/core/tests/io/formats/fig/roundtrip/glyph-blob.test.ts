import { beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { exportFigFile, initCodec, parseFigFile, SceneGraph } from '@open-pencil/core'
import { fontManager } from '@open-pencil/core/text'
import { parseFigBuffer } from '@open-pencil/fig'

import { expectDefined } from '#core-tests/helpers/assert'
import { HEAVY_TEST_TIMEOUT_MS } from '#core-tests/helpers/test-utils'

import { FIXTURES } from '#core-tests/helpers/fig/fixtures'

const INTER_ASSETS = resolve(import.meta.dir, '../../../../../assets')

function countGlyphBlobs(bytes: Uint8Array) {
  const parsed = parseFigBuffer(new Uint8Array(bytes).buffer)
  let glyphs = 0
  let glyphsWithBlob = 0
  const uniqueGlyphBlobs = new Set<number>()

  for (const nc of parsed.nodeChanges) {
    if (nc.type !== 'TEXT') continue
    for (const glyph of nc.derivedTextData?.glyphs ?? []) {
      glyphs++
      if (glyph.commandsBlob !== undefined) {
        glyphsWithBlob++
        uniqueGlyphBlobs.add(glyph.commandsBlob)
      }
    }
  }

  return { glyphs, glyphsWithBlob, uniqueGlyphBlobs: uniqueGlyphBlobs.size }
}

function loadInterFonts() {
  for (const style of ['Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold']) {
    const bytes = readFileSync(resolve(INTER_ASSETS, `Inter-${style}.ttf`))
    fontManager.markLoaded(
      'Inter',
      style,
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    )
  }
}

describe('roundtrip: text glyph blobs', () => {
  beforeAll(
    async () => {
      await initCodec()
    },
    { timeout: HEAVY_TEST_TIMEOUT_MS }
  )

  test(
    'preserves imported Figma glyph blobs for fallback rendering',
    async () => {
      const fixtureBytes = new Uint8Array(readFileSync(resolve(FIXTURES, 'gold-preview.fig')))
      const input = countGlyphBlobs(fixtureBytes)

      const graph = await parseFigFile(
        fixtureBytes.buffer.slice(
          fixtureBytes.byteOffset,
          fixtureBytes.byteOffset + fixtureBytes.byteLength
        )
      )
      const exported = await exportFigFile(graph)
      const output = countGlyphBlobs(exported)

      expect(input.glyphsWithBlob).toBeGreaterThan(0)
      expect(output.glyphsWithBlob).toBe(input.glyphsWithBlob)
      expect(output.uniqueGlyphBlobs).toBeLessThanOrEqual(input.uniqueGlyphBlobs)
    },
    { timeout: HEAVY_TEST_TIMEOUT_MS }
  )

  test('deduplicates generated glyph blobs across repeated text', async () => {
    loadInterFonts()

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    for (let i = 0; i < 100; i++) {
      graph.createNode('TEXT', page.id, {
        name: `Label ${i}`,
        text: 'Hello',
        x: 0,
        y: i * 20,
        width: 80,
        height: 20,
        fontFamily: 'Inter',
        fontWeight: 400,
        fontSize: 14
      })
    }

    const exported = await exportFigFile(graph)
    const output = countGlyphBlobs(exported)

    expect(output.glyphsWithBlob).toBe(500)
    expect(output.uniqueGlyphBlobs).toBeLessThanOrEqual(4)
  })

  test('reopens wrapped text on the lines it was drawn on (#914)', async () => {
    loadInterFonts()

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const card = graph.createNode('FRAME', page.id, {
      name: 'Card',
      width: 260,
      height: 52,
      layoutMode: 'VERTICAL',
      paddingTop: 10,
      paddingRight: 10,
      paddingBottom: 10,
      paddingLeft: 10
    })
    graph.createNode('TEXT', card.id, {
      name: 'Message',
      text: 'A sentence long enough that it has to wrap onto a second line.',
      width: 230,
      height: 32,
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 13,
      lineHeight: 16,
      textAutoResize: 'HEIGHT'
    })

    const reopenedLines = async (bytes: Uint8Array) => {
      const reopened = await parseFigFile(new Uint8Array(bytes).buffer)
      const message = expectDefined(
        [...reopened.nodes.values()].find((node) => node.name === 'Message'),
        'Message'
      )
      const glyphs = message.derivedTextGlyphs ?? []
      expect(glyphs.length).toBeGreaterThan(0)
      for (const glyph of glyphs) expect(glyph.x).toBeLessThan(230)
      return { reopened, lines: new Set(glyphs.map((glyph) => glyph.y)).size }
    }

    const first = await reopenedLines(await exportFigFile(graph))
    expect(first.lines).toBe(2)
    expect((await reopenedLines(await exportFigFile(first.reopened))).lines).toBe(2)
  })
})
