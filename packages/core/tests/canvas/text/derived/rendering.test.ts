import { beforeAll, describe, expect, test } from 'bun:test'

import {
  blackFills,
  derivedGlyphRenderer,
  exportedPixels,
  outlineCommandsBlob,
  squareCommandsBlob
} from '#core-tests/canvas/text/derived/helpers'

import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { SkiaRenderer } from '#core/canvas/renderer'
import { drawDerivedText, snapDerivedGlyphBaseline } from '#core/canvas/text/derived'

let ck: Awaited<ReturnType<typeof getCanvasKit>>

beforeAll(async () => {
  ck = await getCanvasKit()
})

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
      const { pixels, width } = exportedPixels(ck, renderer, graph, page.id, text.id, {
        trimTransparent: false
      })
      const at = (x: number, y: number) =>
        Array.from(pixels.slice((y * width + x) * 4, (y * width + x) * 4 + 4))
      expect(at(5, 5)).toEqual([255, 0, 0, 128])
      expect(at(25, 5)).toEqual([0, 0, 255, 255])
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
      fills: blackFills(),
      derivedTextGlyphs: [
        {
          commandsBlob: squareCommandsBlob(),
          x: 2,
          y: 12,
          fontSize: 10
        }
      ]
    })

    const { surface, renderer } = derivedGlyphRenderer(ck)

    try {
      const { pixels } = exportedPixels(ck, renderer, graph, page.id, text.id)
      expect(Math.max(...pixels.filter((_, index) => index % 4 === 3))).toBeGreaterThan(0)
    } finally {
      surface.delete()
    }
  })
})
