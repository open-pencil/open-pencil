import { beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { exportFigFile, initCodec, parseFigFile, SceneGraph } from '@open-pencil/core'
import { fontManager } from '@open-pencil/core/text'

import { parseFigBuffer } from '#core/kiwi/fig/parse/core'

const FIXTURES = resolve(import.meta.dir, '../../../../fixtures')
const INTER_ASSETS = resolve(import.meta.dir, '../../../../../packages/core/assets')

function countGlyphBlobs(bytes: Uint8Array) {
  const parsed = parseFigBuffer(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  )
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
  beforeAll(async () => {
    await initCodec()
  })

  test('preserves imported Figma glyph blobs for fallback rendering', async () => {
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
  })

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
})
