import { beforeAll, expect, test } from 'bun:test'

import { expectDefined } from '@open-pencil/test-support/assert'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import { SkiaRenderer } from '#core/canvas/renderer'
import { getCanvasKit } from '#core/canvaskit'
import { renderNodesToImage } from '#core/io/formats/raster/render'

let ck: Awaited<ReturnType<typeof getCanvasKit>>

beforeAll(async () => {
  ck = await getCanvasKit()
})

/** A unit square outline in the glyph commands blob format, drawn up from the baseline. */
function squareCommandsBlob(): Uint8Array {
  const corners = [
    [1, 0, 0],
    [2, 1, 0],
    [2, 1, 1],
    [2, 0, 1]
  ] as const
  const blob = new Uint8Array(1 + corners.length * 9)
  const view = new DataView(blob.buffer)
  corners.forEach(([command, x, y], index) => {
    blob[index * 9] = command
    view.setFloat32(index * 9 + 1, x, true)
    view.setFloat32(index * 9 + 5, y, true)
  })
  return blob
}

interface ExportedText {
  height: number
  alpha: (x: number, y: number) => number
}

/**
 * Exports a 40 x 30 fixed-size text drawn by its saved glyphs, one per baseline in `baselines`,
 * since its font is missing.
 */
function exportSavedGlyphText(baselines: number[], props: Partial<SceneNode>): ExportedText {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const text = graph.createNode('TEXT', page.id, {
    width: 40,
    height: 30,
    text: 'ab',
    fontFamily: '__MissingFont__',
    textAutoResize: 'NONE',
    fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
    derivedTextGlyphs: baselines.map((y) => ({
      commandsBlob: squareCommandsBlob(),
      x: 0,
      y,
      fontSize: 20,
      firstCharacter: 0,
      advance: 20
    })),
    derivedTextHeight: 60,
    ...props
  })
  const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
  const renderer = new SkiaRenderer(ck, surface)
  renderer.nodeFontReadiness = () => 'exhausted'

  try {
    const png = expectDefined(
      renderNodesToImage(ck, renderer, graph, page.id, [text.id], { scale: 1, format: 'PNG' }),
      'png'
    )
    const image = expectDefined(ck.MakeImageFromEncoded(png), 'image')
    const width = image.width()
    const height = image.height()
    const pixels = expectDefined(
      image.readPixels(0, 0, {
        alphaType: ck.AlphaType.Unpremul,
        colorType: ck.ColorType.RGBA_8888,
        colorSpace: ck.ColorSpace.SRGB,
        width,
        height
      }),
      'pixels'
    )
    image.delete()
    return { height, alpha: (x, y) => pixels[(y * width + x) * 4 + 3] }
  } finally {
    surface.delete()
  }
}

// Figma 126 draws a fixed-size text's lines past its box: only frames clip.
test('a fixed-size text draws its lines past its box', () => {
  const { height, alpha } = exportSavedGlyphText([25, 55], {})

  // The export reaches the second line, whose glyph fills rows 35 to 55 below the 30 px box.
  expect(height).toBe(60)
  expect(alpha(10, 15)).toBeGreaterThan(0)
  expect(alpha(10, 45)).toBeGreaterThan(0)
})

// Figma 126 lets a bottom-aligned text's lines run up past its box, and blurs them with it.
test('a blurred bottom-aligned text draws the lines above its box', () => {
  const { height, alpha } = exportSavedGlyphText([-5, 25], {
    textAlignVertical: 'BOTTOM',
    effects: [
      {
        type: 'LAYER_BLUR',
        color: { r: 0, g: 0, b: 0, a: 1 },
        offset: { x: 0, y: 0 },
        radius: 1,
        spread: 0,
        visible: true,
        blendMode: 'NORMAL'
      }
    ]
  })
  const blurRows = (height - 60) / 2

  // The first line's glyph fills rows -25 to -5, above the 30 px box.
  expect(alpha(10, blurRows + 15)).toBeGreaterThan(0)
  expect(alpha(10, blurRows + 45)).toBeGreaterThan(0)
})
