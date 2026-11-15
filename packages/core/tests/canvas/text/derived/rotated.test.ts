import { beforeAll, describe, expect, test } from 'bun:test'

import {
  blackFills,
  derivedGlyphRenderer,
  exportedPixels,
  squareCommandsBlob
} from '#core-tests/canvas/text/derived/helpers'

import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { SkiaRenderer } from '#core/canvas/renderer'
import { hasRotatedDerivedGlyphs } from '#core/canvas/text/derived'

let ck: Awaited<ReturnType<typeof getCanvasKit>>

beforeAll(async () => {
  ck = await getCanvasKit()
})

describe('rotated derived glyphs (text-on-path)', () => {
  test('paints the curved glyph placement on the first render with an already loaded exact font', async () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0], 'page')
    const text = graph.createNode('TEXT', page.id, {
      width: 200,
      height: 200,
      text: 'x',
      fontFamily: 'Inter',
      textPathData: {
        network: { vertices: [], segments: [], regions: [] },
        normalizedSize: { x: 200, y: 200 },
        tValue: 0,
        forward: true
      },
      fills: blackFills(),
      derivedTextGlyphs: [
        {
          commandsBlob: squareCommandsBlob(),
          x: 50,
          y: 50,
          fontSize: 20,
          rotation: -Math.PI / 2
        }
      ]
    })
    const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1), 'surface'))
    try {
      await renderer.loadFonts()
      expect(renderer.nodeFontReadiness(text)).toBe('ready')
      const { pixels, width } = exportedPixels(ck, renderer, graph, page.id, text.id)
      const alphaAt = (x: number, y: number) => pixels[(y * width + x) * 4 + 3]
      // Font-space Y inversion and the stored rotation place the square at [50, 70]².
      expect(alphaAt(60, 60)).toBe(255)
      expect(alphaAt(10, 10)).toBe(0)
    } finally {
      renderer.destroy()
    }
  })

  test('hasRotatedDerivedGlyphs detects non-zero rotation', () => {
    expect(
      hasRotatedDerivedGlyphs({
        derivedTextGlyphs: [
          { commandsBlob: squareCommandsBlob(), x: 0, y: 0, fontSize: 12, rotation: 0 }
        ]
      })
    ).toBe(false)
    expect(
      hasRotatedDerivedGlyphs({
        derivedTextGlyphs: [
          { commandsBlob: squareCommandsBlob(), x: 0, y: 0, fontSize: 12, rotation: -1.5 }
        ]
      })
    ).toBe(true)
  })

  test('draws rotated derived glyphs without throwing', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      width: 200,
      height: 200,
      text: 'x',
      fontFamily: '__MissingFont__',
      fills: blackFills(),
      derivedTextGlyphs: [
        {
          commandsBlob: squareCommandsBlob(),
          x: 50,
          y: 50,
          fontSize: 20,
          rotation: -Math.PI / 2
        }
      ]
    })

    // The font is intentionally missing, so the baked glyphs paint.
    const { surface, renderer } = derivedGlyphRenderer(ck)
    try {
      // A blank canvas also yields a non-empty PNG, so decode and require the
      // rotated glyph to actually paint pixels — not merely render without throwing.
      const { pixels } = exportedPixels(ck, renderer, graph, page.id, text.id)
      let paintedPixels = 0
      for (let index = 3; index < pixels.length; index += 4) {
        if ((pixels[index] ?? 0) > 0) paintedPixels++
      }
      expect(paintedPixels).toBeGreaterThan(0)
    } finally {
      surface.delete()
    }
  })
})
