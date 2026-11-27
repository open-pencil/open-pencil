import { describe, expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { SceneGraph, type SceneNode, type Stroke } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

const ck = await getCanvasKit()
const WIDTH = 140
const HEIGHT = 100

const stroke = (weight: number, align: Stroke['align']): Stroke => ({
  type: 'SOLID',
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  weight,
  align
})

type Kind = 'RECTANGLE' | 'ELLIPSE' | 'POLYGON' | 'STAR' | 'FRAME' | 'SHAPE_WITH_TEXT'

/** How many pixels of a page holding one fill-less `kind` stroked with `strokes` carry ink. */
function inked(kind: Kind, strokes: Stroke[], extra: Partial<SceneNode> = {}) {
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'page')
  graph.createNode(kind, page.id, {
    x: 20,
    y: 20,
    width: 100,
    height: 60,
    fills: [],
    strokes,
    ...extra
  })
  const surface = expectDefined(ck.MakeSurface(WIDTH, HEIGHT), 'surface')
  const renderer = new SkiaRenderer(ck, surface)
  try {
    renderer.pageId = page.id
    renderer.renderSceneToCanvas(surface.getCanvas(), graph, page.id)
    surface.flush()
    const image = surface.makeImageSnapshot()
    const pixels = expectDefined(
      image.readPixels(0, 0, {
        width: WIDTH,
        height: HEIGHT,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      }),
      'pixels'
    )
    image.delete()
    let total = 0
    for (let index = 3; index < pixels.length; index += 4) if ((pixels[index] ?? 0) > 0) total++
    return total
  } finally {
    renderer.destroy()
  }
}

describe('stroke weight', () => {
  test.each<Kind>(['RECTANGLE', 'ELLIPSE', 'POLYGON', 'STAR', 'FRAME', 'SHAPE_WITH_TEXT'])(
    'a zero-weight stroke on a %s draws nothing at any alignment, as in Figma',
    (kind) => {
      expect(inked(kind, [stroke(1, 'CENTER')])).toBeGreaterThan(0)
      for (const align of ['CENTER', 'INSIDE', 'OUTSIDE'] as const) {
        expect(inked(kind, [stroke(0, align)])).toBe(0)
        expect(inked(kind, [{ ...stroke(0, align), dashPattern: [4, 4] }])).toBe(0)
      }
    }
  )

  test('sides of their own weight still draw when the stroke weight is zero', () => {
    const sides = {
      independentStrokeWeights: true,
      borderTopWeight: 2,
      borderRightWeight: 0,
      borderBottomWeight: 0,
      borderLeftWeight: 0
    }
    expect(inked('RECTANGLE', [stroke(0, 'INSIDE')], sides)).toBe(200)
  })
})
