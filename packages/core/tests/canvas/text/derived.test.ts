import { beforeAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { SkiaRenderer } from '#core/canvas/renderer'
import { getCanvasKit } from '#core/canvaskit'
import { renderNodesToImage } from '#core/io/formats/raster/render'

import { SceneGraph } from '@open-pencil/scene-graph'

let ck: Awaited<ReturnType<typeof getCanvasKit>>

beforeAll(async () => {
  ck = await getCanvasKit()
})

/** A unit square outline in the glyph commands blob format. */
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

/** The highest coverage on the underline rows at column `x` of a rendered text layer. */
function underlineAlpha(pixels: ArrayLike<number>, width: number, x: number): number {
  return Math.max(...[15, 16].map((y) => pixels[(y * width + x) * 4 + 3]))
}

describe('derived text decorations', () => {
  test('an underline ends where the glyphs end, not at the layer edge', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      width: 40,
      height: 24,
      text: 'x',
      fontFamily: '__MissingFont__',
      textDecoration: 'UNDERLINE',
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
      derivedTextGlyphs: [
        { commandsBlob: squareCommandsBlob(), x: 2, y: 12, fontSize: 10, advance: 10 }
      ]
    })
    const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
    const renderer = new SkiaRenderer(ck, surface)
    // The font is missing, so the saved glyphs are what draws the text.
    renderer.nodeFontReadiness = () => 'exhausted'

    try {
      const png = expectDefined(
        renderNodesToImage(ck, renderer, graph, page.id, [text.id], { scale: 1, format: 'PNG' }),
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
      expect(underlineAlpha(pixels, image.width(), 8)).toBeGreaterThan(0)
      expect(underlineAlpha(pixels, image.width(), 30)).toBe(0)
      image.delete()
    } finally {
      surface.delete()
    }
  })
})
