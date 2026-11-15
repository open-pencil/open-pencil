import { beforeAll, describe, expect, test } from 'bun:test'

import {
  blackFills,
  derivedGlyphRenderer,
  exportedPixels,
  savedGlyphs
} from '#core-tests/canvas/text/derived/helpers'

import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { SceneGraph } from '@open-pencil/scene-graph'

let ck: Awaited<ReturnType<typeof getCanvasKit>>

beforeAll(async () => {
  ck = await getCanvasKit()
})

describe('derived text underlines', () => {
  test('draws underlines for Figma-derived text decorations', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      width: 20,
      height: 24,
      text: 'x',
      fontFamily: '__MissingFont__',
      textDecoration: 'UNDERLINE',
      fills: blackFills(),
      derivedTextGlyphs: savedGlyphs('x')
    })

    const { surface, renderer } = derivedGlyphRenderer(ck)

    try {
      const { pixels, width } = exportedPixels(ck, renderer, graph, page.id, text.id)
      // 10px text on a baseline at 12 is underlined from 13.99 to 14.67, as Figma places it.
      expect(pixels[(14 * width + 6) * 4 + 3]).toBeGreaterThan(0)
    } finally {
      surface.delete()
    }
  })

  test('does not draw base derived underlines through NONE style runs', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      width: 60,
      height: 28,
      text: 'on off',
      fontFamily: '__MissingFont__',
      textDecoration: 'UNDERLINE',
      styleRuns: [
        {
          start: 3,
          length: 3,
          style: { textDecoration: 'NONE' }
        }
      ],
      fills: blackFills(),
      derivedTextGlyphs: savedGlyphs('on off')
    })

    const { surface, renderer } = derivedGlyphRenderer(ck)

    try {
      const { pixels, width } = exportedPixels(ck, renderer, graph, page.id, text.id)
      const leftUnderlineAlpha = pixels[(14 * width + 12) * 4 + 3] ?? 0
      const disabledUnderlineAlpha = pixels[(14 * width + 45) * 4 + 3] ?? 0
      expect(leftUnderlineAlpha).toBeGreaterThan(0)
      expect(disabledUnderlineAlpha).toBe(0)
    } finally {
      surface.delete()
    }
  })

  test('draws styled decoration runs for Figma-derived text', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      width: 60,
      height: 28,
      text: 'red blue',
      fontFamily: '__MissingFont__',
      textDecoration: 'UNDERLINE',
      textDecorationStyle: 'WAVY',
      textDecorationThickness: 2,
      textDecorationFills: [
        {
          type: 'SOLID',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      styleRuns: [
        {
          start: 4,
          length: 4,
          style: {
            textDecorationStyle: 'DOTTED',
            textDecorationThickness: 3,
            textDecorationFills: [
              {
                type: 'SOLID',
                color: { r: 0, g: 0, b: 1, a: 1 },
                opacity: 1,
                visible: true
              }
            ]
          }
        }
      ],
      fills: blackFills(),
      derivedTextGlyphs: savedGlyphs('red blue')
    })

    const { surface, renderer } = derivedGlyphRenderer(ck)

    try {
      const { pixels } = exportedPixels(ck, renderer, graph, page.id, text.id)
      let redPixels = 0
      let bluePixels = 0
      for (let index = 0; index < pixels.length; index += 4) {
        const red = pixels[index] ?? 0
        const green = pixels[index + 1] ?? 0
        const blue = pixels[index + 2] ?? 0
        const alpha = pixels[index + 3] ?? 0
        if (alpha > 0 && red > 150 && green < 80 && blue < 80) redPixels++
        if (alpha > 0 && blue > 150 && red < 80 && green < 80) bluePixels++
      }

      expect(redPixels).toBeGreaterThan(0)
      expect(bluePixels).toBeGreaterThan(0)
    } finally {
      surface.delete()
    }
  })
})
