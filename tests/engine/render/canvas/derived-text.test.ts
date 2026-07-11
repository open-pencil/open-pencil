import { beforeAll, describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { initCanvasKit } from '#cli/headless'
import { SkiaRenderer } from '#core/canvas/renderer'
import {
  derivedUnderlineRect,
  hasRotatedFigmaDerivedGlyphs,
  shouldUseHardFigmaDerivedGlyphCoverage,
  snapFigmaDerivedGlyphBaseline
} from '#core/canvas/text-derived'
import { renderNodesToImage } from '#core/io/formats/raster/render'

import { expectDefined } from '#tests/helpers/assert'

let ck: Awaited<ReturnType<typeof initCanvasKit>>

beforeAll(async () => {
  ck = await initCanvasKit()
})

function squareCommandsBlob(): Uint8Array {
  const blob = new Uint8Array(1 + 4 * 9 + 1)
  const view = new DataView(blob.buffer)
  let offset = 0
  const commands = [
    { command: 1, x: 0, y: 0 },
    { command: 2, x: 1, y: 0 },
    { command: 2, x: 1, y: 1 },
    { command: 2, x: 0, y: 1 }
  ]
  for (const { command, x, y } of commands) {
    blob[offset] = command
    view.setFloat32(offset + 1, x, true)
    view.setFloat32(offset + 5, y, true)
    offset += 9
  }
  blob[offset] = 0
  return blob
}

describe('derived text rendering', () => {
  test('snaps Figma glyph baselines to device pixels', () => {
    expect(snapFigmaDerivedGlyphBaseline(47.45454406738281)).toBe(47)
    expect(snapFigmaDerivedGlyphBaseline(15.090909004211426)).toBe(15)
    expect(snapFigmaDerivedGlyphBaseline(17.81818199157715)).toBe(18)
  })

  test('uses hard source coverage only for regular 20px derived glyphs', () => {
    expect(shouldUseHardFigmaDerivedGlyphCoverage({ fontSize: 20, fontWeight: 400 })).toBeTrue()
    expect(shouldUseHardFigmaDerivedGlyphCoverage({ fontSize: 20, fontWeight: 600 })).toBeFalse()
    expect(shouldUseHardFigmaDerivedGlyphCoverage({ fontSize: 14, fontWeight: 500 })).toBeFalse()
  })

  test('places derived underlines at Figma-like subpixel coverage bounds', () => {
    expect(derivedUnderlineRect({ width: 70 }, 17)).toEqual({
      x1: 0,
      y1: 19.75,
      x2: 69.25,
      y2: 20.75
    })
  })

  test('draws Figma-derived glyphs even when the font is unavailable', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      width: 20,
      height: 20,
      text: 'x',
      fontFamily: '__MissingFont__',
      fills: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      figmaDerivedTextGlyphs: [
        {
          commandsBlob: squareCommandsBlob(),
          x: 2,
          y: 12,
          fontSize: 10
        }
      ]
    })

    const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
    const renderer = new SkiaRenderer(ck, surface)

    try {
      const png = expectDefined(
        renderNodesToImage(ck, renderer, graph, page.id, [text.id], {
          scale: 1,
          format: 'PNG'
        }),
        'png'
      )
      const image = expectDefined(ck.MakeImageFromEncoded(png), 'image')
      const pixels = expectDefined(
        image.readPixels(0, 0, {
          alphaType: ck.AlphaType.Unpremul,
          colorType: ck.ColorType.RGBA_8888,
          colorSpace: ck.ColorSpace.SRGB,
          width: image.width(),
          height: image.height()
        }),
        'pixels'
      )

      expect(Math.max(...pixels.filter((_, index) => index % 4 === 3))).toBeGreaterThan(0)
      image.delete()
    } finally {
      surface.delete()
    }
  })

  test('draws underlines for Figma-derived text decorations', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      width: 20,
      height: 24,
      text: 'x',
      fontFamily: '__MissingFont__',
      textDecoration: 'UNDERLINE',
      fills: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      figmaDerivedTextGlyphs: [
        {
          commandsBlob: squareCommandsBlob(),
          x: 2,
          y: 12,
          fontSize: 10
        }
      ]
    })

    const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
    const renderer = new SkiaRenderer(ck, surface)

    try {
      const png = expectDefined(
        renderNodesToImage(ck, renderer, graph, page.id, [text.id], {
          scale: 1,
          format: 'PNG'
        }),
        'png'
      )
      const image = expectDefined(ck.MakeImageFromEncoded(png), 'image')
      const pixels = expectDefined(
        image.readPixels(0, 0, {
          alphaType: ck.AlphaType.Unpremul,
          colorType: ck.ColorType.RGBA_8888,
          colorSpace: ck.ColorSpace.SRGB,
          width: image.width(),
          height: image.height()
        }),
        'pixels'
      )

      const underlinedRows = [15, 16].map((y) => pixels[(y * image.width() + 8) * 4 + 3])
      expect(Math.max(...underlinedRows)).toBeGreaterThan(0)
      image.delete()
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
      fills: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      figmaDerivedTextGlyphs: [
        {
          commandsBlob: squareCommandsBlob(),
          x: 2,
          y: 12,
          fontSize: 10
        }
      ]
    })

    const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
    const renderer = new SkiaRenderer(ck, surface)

    try {
      const png = expectDefined(
        renderNodesToImage(ck, renderer, graph, page.id, [text.id], {
          scale: 1,
          format: 'PNG'
        }),
        'png'
      )
      const image = expectDefined(ck.MakeImageFromEncoded(png), 'image')
      const pixels = expectDefined(
        image.readPixels(0, 0, {
          alphaType: ck.AlphaType.Unpremul,
          colorType: ck.ColorType.RGBA_8888,
          colorSpace: ck.ColorSpace.SRGB,
          width: image.width(),
          height: image.height()
        }),
        'pixels'
      )

      const leftUnderlineAlpha = Math.max(
        pixels[(15 * image.width() + 12) * 4 + 3] ?? 0,
        pixels[(16 * image.width() + 12) * 4 + 3] ?? 0
      )
      const disabledUnderlineAlpha = Math.max(
        pixels[(15 * image.width() + 45) * 4 + 3] ?? 0,
        pixels[(16 * image.width() + 45) * 4 + 3] ?? 0
      )
      expect(leftUnderlineAlpha).toBeGreaterThan(0)
      expect(disabledUnderlineAlpha).toBe(0)
      image.delete()
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
      fills: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      figmaDerivedTextGlyphs: [
        {
          commandsBlob: squareCommandsBlob(),
          x: 2,
          y: 12,
          fontSize: 10
        }
      ]
    })

    const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
    const renderer = new SkiaRenderer(ck, surface)

    try {
      const png = expectDefined(
        renderNodesToImage(ck, renderer, graph, page.id, [text.id], {
          scale: 1,
          format: 'PNG'
        }),
        'png'
      )
      const image = expectDefined(ck.MakeImageFromEncoded(png), 'image')
      const pixels = expectDefined(
        image.readPixels(0, 0, {
          alphaType: ck.AlphaType.Unpremul,
          colorType: ck.ColorType.RGBA_8888,
          colorSpace: ck.ColorSpace.SRGB,
          width: image.width(),
          height: image.height()
        }),
        'pixels'
      )

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
      image.delete()
    } finally {
      surface.delete()
    }
  })
})

describe('rotated derived glyphs (text-on-path)', () => {
  test('hasRotatedFigmaDerivedGlyphs detects non-zero rotation', () => {
    expect(
      hasRotatedFigmaDerivedGlyphs({
        figmaDerivedTextGlyphs: [
          { commandsBlob: squareCommandsBlob(), x: 0, y: 0, fontSize: 12, rotation: 0 }
        ]
      })
    ).toBe(false)
    expect(
      hasRotatedFigmaDerivedGlyphs({
        figmaDerivedTextGlyphs: [
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
      fills: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      figmaDerivedTextGlyphs: [
        {
          commandsBlob: squareCommandsBlob(),
          x: 50,
          y: 50,
          fontSize: 20,
          rotation: -Math.PI / 2
        }
      ]
    })

    const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
    const renderer = new SkiaRenderer(ck, surface)
    try {
      const png = expectDefined(
        renderNodesToImage(ck, renderer, graph, page.id, [text.id], {
          scale: 1,
          format: 'PNG'
        }),
        'png'
      )
      expect(png.byteLength).toBeGreaterThan(0)
    } finally {
      surface.delete()
    }
  })
})
