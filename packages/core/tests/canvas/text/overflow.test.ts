import { beforeAll, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SceneGraph } from '@open-pencil/scene-graph'

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

// Figma 126 draws a fixed-size text's lines past its box: only frames clip.
test('a fixed-size text draws its lines past its box', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const glyph = (y: number) => ({
    commandsBlob: squareCommandsBlob(),
    x: 0,
    y,
    fontSize: 20,
    firstCharacter: 0,
    advance: 20
  })
  const text = graph.createNode('TEXT', page.id, {
    width: 40,
    height: 30,
    text: 'ab',
    fontFamily: '__MissingFont__',
    textAutoResize: 'NONE',
    fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
    derivedTextGlyphs: [glyph(25), glyph(55)],
    derivedTextHeight: 60
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
    const alpha = (x: number, y: number) => pixels[(y * image.width() + x) * 4 + 3]
    // The export reaches the second line, whose glyph fills rows 35 to 55 below the 30 px box.
    expect(image.height()).toBe(60)
    expect(alpha(10, 15)).toBeGreaterThan(0)
    expect(alpha(10, 45)).toBeGreaterThan(0)
    image.delete()
  } finally {
    surface.delete()
  }
})
