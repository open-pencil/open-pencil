import { beforeAll, describe, expect, test } from 'bun:test'

import { SceneGraph, type SceneNode, type Stroke } from '@open-pencil/scene-graph'
import { createShapeWithText } from '@open-pencil/scene-graph/generated'
import { expectDefined } from '@open-pencil/test-support/assert'

import { SkiaRenderer } from '#core/canvas/renderer/skia'
import { getCanvasKit } from '#core/canvaskit'
import { renderNodesToImage } from '#core/io/formats/raster/render'

import { expectRgbaPixels } from '../helpers'

let ck: Awaited<ReturnType<typeof getCanvasKit>>

beforeAll(async () => {
  ck = await getCanvasKit()
})

const GREY = { r: 0.9, g: 0.9, b: 0.9, a: 1 }
const STROKE: Stroke = {
  type: 'SOLID',
  color: { r: 0.46, g: 0.46, b: 0.46, a: 1 },
  opacity: 1,
  visible: true,
  weight: 4,
  align: 'CENTER'
}

/** The alpha of each pixel of a 192 × 128 shape of `kind` drawn at scale 1, as `alpha(x, y)`. */
function drawnShape(kind: SceneNode['shapeWithTextType'], strokes: Stroke[]) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const shape = createShapeWithText(
    graph,
    page.id,
    {
      shapeWithTextType: kind,
      width: 192,
      height: 128,
      fills: [{ type: 'SOLID', color: GREY, opacity: 1, visible: true }],
      strokes
    },
    {}
  )
  const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
  const renderer = new SkiaRenderer(ck, surface)
  try {
    const png = expectDefined(
      renderNodesToImage(ck, renderer, graph, page.id, [shape.id], { scale: 1, format: 'PNG' }),
      'png'
    )
    const image = expectDefined(ck.MakeImageFromEncoded(png), 'image')
    const width = image.width()
    const pixels = expectRgbaPixels(
      image.readPixels(0, 0, {
        alphaType: ck.AlphaType.Unpremul,
        colorType: ck.ColorType.RGBA_8888,
        colorSpace: ck.ColorSpace.SRGB,
        width,
        height: image.height()
      })
    )
    image.delete()
    // A stroke centred on the outline grows the image by half its weight on every side.
    const offset = strokes.length > 0 ? STROKE.weight / 2 : 0
    return (x: number, y: number) => pixels[((y + offset) * width + x + offset) * 4 + 3]
  } finally {
    surface.dispose()
  }
}

describe('shapes with text', () => {
  test('without a stroke, cut their outline and inner lines out of the fill, as FigJam does', () => {
    const alpha = drawnShape('ENG_DATABASE', [])
    // The front rim lies 48 down the middle; FigJam cuts 3 units along it.
    expect(alpha(96, 48)).toBe(0)
    expect(alpha(96, 44)).toBe(255)
    expect(alpha(96, 52)).toBe(255)
    // Half the band insets the outline.
    expect(alpha(0, 80)).toBe(0)
    expect(alpha(3, 80)).toBe(255)
  })

  test('with a stroke, fill under their inner lines, which the stroke draws', () => {
    const alpha = drawnShape('ENG_DATABASE', [STROKE])
    expect(alpha(96, 48)).toBe(255)
    expect(alpha(0, 80)).toBe(255)
  })

  test('without inner lines, keep their whole fill', () => {
    expect(drawnShape('SQUARE', [])(0, 80)).toBe(255)
  })
})
