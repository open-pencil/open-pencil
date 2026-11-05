import { beforeAll, describe, expect, test } from 'bun:test'

import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { SkiaRenderer } from '#core/canvas/renderer'
import {
  drawDerivedText,
  hasRotatedDerivedGlyphs,
  snapDerivedGlyphBaseline
} from '#core/canvas/text/derived'
import { renderNodesToImage } from '#core/io/formats/raster/render'
let ck: Awaited<ReturnType<typeof initCanvasKit>>

beforeAll(async () => {
  ck = await initCanvasKit()
})

/** Saved glyphs as Figma saves them, one per character with its advance, 8px apart from x 2. */
function savedGlyphs(text: string) {
  return Array.from(text, (_, index) => ({
    commandsBlob: squareCommandsBlob(),
    x: 2 + index * 8,
    y: 12,
    fontSize: 10,
    firstCharacter: index,
    advance: 8
  }))
}

function useDerivedGlyphFallback(renderer: SkiaRenderer): void {
  renderer.nodeFontReadiness = () => 'exhausted'
}

/** A saved glyph outline: move to the first point, lines through the rest, in em units. */
function outlineCommandsBlob(points: readonly (readonly [number, number])[]): Uint8Array {
  const blob = new Uint8Array(points.length * 9 + 1)
  const view = new DataView(blob.buffer)
  for (const [index, [x, y]] of points.entries()) {
    blob[index * 9] = index === 0 ? 1 : 2
    view.setFloat32(index * 9 + 1, x, true)
    view.setFloat32(index * 9 + 5, y, true)
  }
  return blob
}

function squareCommandsBlob(): Uint8Array {
  return outlineCommandsBlob([
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1]
  ])
}

/** The alpha of every pixel of one triangular saved glyph, drawn at `scale`. */
function savedGlyphAlphas(node: { fontSize: number; fontWeight: number }, scale: number) {
  const graph = new SceneGraph()
  const side = 24
  const text = graph.createNode('TEXT', graph.getPages()[0].id, {
    ...node,
    text: 'A',
    width: side,
    height: side,
    derivedTextGlyphs: [
      {
        commandsBlob: outlineCommandsBlob([
          [0, 0],
          [1, 0],
          [0, 1]
        ]),
        x: 2,
        y: 22,
        fontSize: node.fontSize,
        firstCharacter: 0
      }
    ]
  })
  const surface = expectDefined(ck.MakeSurface(side * scale, side * scale), 'surface')
  const renderer = new SkiaRenderer(ck, surface)
  try {
    const canvas = surface.getCanvas()
    canvas.clear(ck.TRANSPARENT)
    canvas.scale(scale, scale)
    renderer.fillPaint.setColor(ck.BLACK)
    expect(drawDerivedText(renderer, canvas, text)).toBeTrue()
    const pixels = expectDefined(
      canvas.readPixels(0, 0, {
        alphaType: ck.AlphaType.Unpremul,
        colorType: ck.ColorType.RGBA_8888,
        colorSpace: ck.ColorSpace.SRGB,
        width: side * scale,
        height: side * scale
      }),
      'pixels'
    )
    return pixels.filter((_, index) => index % 4 === 3)
  } finally {
    renderer.destroy()
  }
}

describe('derived text rendering', () => {
  test('uses run alpha and inherited paint at saved cluster positions', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      text: 'ffiX',
      width: 40,
      height: 20,
      fontSize: 10,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1, visible: true }],
      styleRuns: [
        {
          start: 0,
          length: 3,
          style: {
            fills: [
              { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 0.5, visible: true }
            ]
          }
        }
      ],
      derivedTextGlyphs: [
        { commandsBlob: squareCommandsBlob(), x: 0, y: 10, fontSize: 10, firstCharacter: 0 },
        { commandsBlob: squareCommandsBlob(), x: 20, y: 10, fontSize: 10, firstCharacter: 3 }
      ]
    })
    const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
    const renderer = new SkiaRenderer(ck, surface)
    // Saved glyphs draw while the face is not the text's own; a loaded face lays the text out live.
    renderer.nodeFontReadiness = () => 'substituted'
    try {
      const png = expectDefined(
        renderNodesToImage(ck, renderer, graph, page.id, [text.id], {
          scale: 1,
          format: 'PNG',
          trimTransparent: false
        }),
        'png'
      )
      const image = expectDefined(ck.MakeImageFromEncoded(png), 'image')
      try {
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
        const at = (x: number, y: number) =>
          Array.from(pixels.slice((y * image.width() + x) * 4, (y * image.width() + x) * 4 + 4))
        expect(at(5, 5)).toEqual([255, 0, 0, 128])
        expect(at(25, 5)).toEqual([0, 0, 255, 255])
      } finally {
        image.delete()
      }
    } finally {
      renderer.destroy()
    }
  })

  test('glyph silhouettes are disposed by cache clearing and renderer destruction', () => {
    const renderer = new SkiaRenderer(
      ck,
      expectDefined(ck.MakeSurface(8, 8), 'glyph cache surface')
    )
    const first = new ck.Path()
    const second = new ck.Path()
    let disposedByRenderer = false
    try {
      renderer.textCaches.glyphSilhouettes.set('first', first)
      expect(renderer.textCaches.glyphSilhouettes.peek('first')).toBe(first)
      renderer.textCaches.glyphSilhouettes.clear()
      expect(first.isDeleted()).toBe(true)
      renderer.textCaches.glyphSilhouettes.set('second', second)
    } finally {
      try {
        renderer.destroy()
        disposedByRenderer = second.isDeleted()
      } finally {
        if (!first.isDeleted()) first.delete()
        if (!second.isDeleted()) second.delete()
      }
    }
    expect(disposedByRenderer).toBe(true)
  })

  test('snaps Figma glyph baselines to device pixels', () => {
    expect(snapDerivedGlyphBaseline(47.45454406738281)).toBe(47)
    expect(snapDerivedGlyphBaseline(15.090909004211426)).toBe(15)
    expect(snapDerivedGlyphBaseline(17.81818199157715)).toBe(18)
  })

  // Figma antialiases saved glyphs at every size; 20px regular text used to be drawn aliased.
  test.each([
    [20, 400, 1],
    [20, 400, 5],
    [18, 400, 1],
    [20, 600, 1]
  ])(
    'antialiases the edges of %dpx weight %d saved glyphs at scale %d',
    (fontSize, fontWeight, scale) => {
      const alphas = savedGlyphAlphas({ fontSize, fontWeight }, scale)
      const partial = alphas.filter((alpha) => alpha > 0 && alpha < 255)
      expect(partial.length).toBeGreaterThan(fontSize * scale * 0.5)
    }
  )

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
      derivedTextGlyphs: [
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
    useDerivedGlyphFallback(renderer)

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
      derivedTextGlyphs: savedGlyphs('x')
    })

    const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
    const renderer = new SkiaRenderer(ck, surface)
    useDerivedGlyphFallback(renderer)

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

      // 10px text on a baseline at 12 is underlined from 13.99 to 14.67, as Figma places it.
      expect(pixels[(14 * image.width() + 6) * 4 + 3]).toBeGreaterThan(0)
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
      derivedTextGlyphs: savedGlyphs('on off')
    })

    const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
    const renderer = new SkiaRenderer(ck, surface)
    useDerivedGlyphFallback(renderer)

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

      const leftUnderlineAlpha = pixels[(14 * image.width() + 12) * 4 + 3] ?? 0
      const disabledUnderlineAlpha = pixels[(14 * image.width() + 45) * 4 + 3] ?? 0
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
      derivedTextGlyphs: savedGlyphs('red blue')
    })

    const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
    const renderer = new SkiaRenderer(ck, surface)
    useDerivedGlyphFallback(renderer)

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
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
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
      const png = expectDefined(
        renderNodesToImage(ck, renderer, graph, page.id, [text.id], {
          scale: 1,
          format: 'PNG'
        }),
        'png'
      )
      const image = expectDefined(ck.MakeImageFromEncoded(png), 'image')
      try {
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
        const alphaAt = (x: number, y: number) => pixels[(y * image.width() + x) * 4 + 3]
        // Font-space Y inversion and the stored rotation place the square at [50, 70]².
        expect(alphaAt(60, 60)).toBe(255)
        expect(alphaAt(10, 10)).toBe(0)
      } finally {
        image.delete()
      }
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
      fills: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
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

    const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
    const renderer = new SkiaRenderer(ck, surface)
    // The font is intentionally missing; baked glyphs only paint once font
    // resolution is exhausted (see renderText's readiness gate).
    useDerivedGlyphFallback(renderer)
    try {
      const png = expectDefined(
        renderNodesToImage(ck, renderer, graph, page.id, [text.id], {
          scale: 1,
          format: 'PNG'
        }),
        'png'
      )
      // A blank canvas also yields a non-empty PNG, so decode and require the
      // rotated glyph to actually paint pixels — not merely render without throwing.
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
      let paintedPixels = 0
      for (let index = 3; index < pixels.length; index += 4) {
        if ((pixels[index] ?? 0) > 0) paintedPixels++
      }
      image.delete()
      expect(paintedPixels).toBeGreaterThan(0)
    } finally {
      surface.delete()
    }
  })
})
