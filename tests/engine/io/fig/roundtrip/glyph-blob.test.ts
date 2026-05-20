import { beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  exportFigFile,
  initCodec,
  parseFigFile,
  SceneGraph,
  type SceneNode
} from '@open-pencil/core'
import { parseFigBuffer } from '@open-pencil/core/kiwi/fig/parse/core'

import { expectDefined } from '#tests/helpers/assert'
import { collectAllNodes, countByType } from '#tests/helpers/fig-traversal'

const FIXTURES = resolve(import.meta.dir, '../../../../fixtures')

setDefaultTimeout(60_000)

/**
 * Roundtrip tests for .fig file blob preservation.
 *
 * The core invariant: .fig export must NOT create commandsBlob entries for
 * glyph path outlines. Glyph paths are derivable from font data at render time.
 * Including them causes ~16× file size bloat (2 MB → 32 MB for text-heavy docs).
 * The original Figma format stores glyph positions but omits commandsBlob.
 */
describe('roundtrip: blob count preservation', () => {
  describe('text-heavy document with glyphs (no blob commands)', () => {
    let graph: SceneGraph
    let allNodes: SceneNode[]
    let textNodeCount: number

    beforeAll(async () => {
      await initCodec()

      graph = new SceneGraph()
      const page = graph.getPages()[0]

      // Create many TEXT nodes to simulate a text-heavy document
      // (like manycopies.fig with 13944 text nodes)
      for (let i = 0; i < 100; i++) {
        graph.createNode('TEXT', page.id, {
          name: `Text ${i}`,
          x: (i % 10) * 120,
          y: Math.floor(i / 10) * 40,
          width: 100,
          height: 20,
          text: `Hello ${i}`,
          fontSize: 14,
          fontFamily: 'Inter',
          fontWeight: 400,
          textAlignHorizontal: 'LEFT'
        })
      }

      allNodes = collectAllNodes(graph)
      textNodeCount = countByType(allNodes).get('TEXT') ?? 0
    })

    test('creates text nodes', () => {
      expect(textNodeCount).toBe(100)
    })

    test('export produces zero blobs', async () => {
      const figBytes = await exportFigFile(graph)

      // Re-parse to inspect blob count
      const reparsed = parseFigBuffer(figBytes.buffer as ArrayBuffer)

      expect(reparsed.blobs.length).toBe(0)
    })

    test('export has no commandsBlob in derived text glyphs', async () => {
      const figBytes = await exportFigFile(graph)
      const reparsed = parseFigBuffer(figBytes.buffer as ArrayBuffer)

      let glyphsWithBlob = 0
      let glyphsWithoutBlob = 0

      for (const nc of reparsed.nodeChanges) {
        if (nc.type !== 'TEXT') continue
        for (const glyph of nc.derivedTextData?.glyphs ?? []) {
          if (glyph.commandsBlob !== undefined) glyphsWithBlob++
          else glyphsWithoutBlob++
        }
      }

      expect(glyphsWithBlob).toBe(0)
      // Glyphs without commandsBlob are expected — positions without path commands
      expect(glyphsWithoutBlob).toBeGreaterThanOrEqual(0)
    })

    test('roundtrip preserves text content and properties', async () => {
      const figBytes = await exportFigFile(graph)
      const reImported = await parseFigFile(figBytes.buffer as ArrayBuffer)
      const reNodes = collectAllNodes(reImported)

      const textNodes = reNodes.filter((n) => n.type === 'TEXT')
      expect(textNodes.length).toBe(100)

      // Check first text node content
      const firstText = textNodes.find((n) => n.name === 'Text 0')
      expect(firstText).toBeDefined()
      expect(expectDefined(firstText, 'firstText').text).toBe('Hello 0')
      expect(firstText.fontSize).toBe(14)
      expect(firstText.fontFamily).toBe('Inter')
    })

    test('export size is reasonable (no 16× bloat)', async () => {
      const figBytes = await exportFigFile(graph)
      const sizeKB = figBytes.byteLength / 1024

      // 100 text nodes with no blobs should be well under 100 KB
      // If blobs were included, each glyph command blob ~666 bytes × 7 chars × 100 nodes
      // = ~466 KB of blob data alone
      expect(sizeKB).toBeLessThan(100)
    })
  })

  describe('real fixture roundtrip', () => {
    test('gold-preview.fig roundtrips without glyph command blobs', async () => {
      await initCodec()

      // Import the fixture
      const fixtureBytes = new Uint8Array(readFileSync(resolve(FIXTURES, 'gold-preview.fig')))

      const graph = await parseFigFile(fixtureBytes.buffer as ArrayBuffer)
      const figBytes = await exportFigFile(graph)

      // Re-parse to check for glyph command blobs
      const reparsed = parseFigBuffer(figBytes.buffer as ArrayBuffer)

      // Verify no text glyph has commandsBlob
      let glyphBlobCount = 0
      for (const nc of reparsed.nodeChanges) {
        if (nc.type !== 'TEXT') continue
        for (const glyph of nc.derivedTextData?.glyphs ?? []) {
          if (glyph.commandsBlob !== undefined) glyphBlobCount++
        }
      }
      // CRITICAL: No glyph command blobs should be created.
      // Glyph paths are derivable from font data at render time.
      // Including them causes ~16× file size bloat for text-heavy docs.
      expect(glyphBlobCount).toBe(0)
    })
  })
})
