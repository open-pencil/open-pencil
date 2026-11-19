import { afterEach, describe, expect, test } from 'bun:test'

import { buildP3BlendCells, P3_BLENDS, P3_CELL } from '#core-tests/helpers/display-p3'

import { SceneGraph, type DocumentColorSpace } from '@open-pencil/scene-graph'
import { toExtendedSRGB } from '@open-pencil/scene-graph/color'
import { expectDefined } from '@open-pencil/test-support/assert'

import { render } from '#core/canvas/renderer/pipeline'
import { SkiaRenderer } from '#core/canvas/renderer/skia'
import { getCanvasKit } from '#core/canvaskit'

const ck = await getCanvasKit()
const WIDTH = P3_BLENDS[0].modes.length * P3_CELL
const HEIGHT = P3_BLENDS.length * P3_CELL

const renderers: SkiaRenderer[] = []
afterEach(() => {
  for (const renderer of renderers.splice(0)) renderer.destroy()
})

/** Draws the blend cells of a document in `space` on an sRGB screen, as the canvas does. */
function drawOnSRGBScreen(space: DocumentColorSpace) {
  const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(WIDTH, HEIGHT), 'surface'))
  renderers.push(renderer)
  const graph = new SceneGraph()
  graph.documentColorSpace = space
  const page = graph.getPages()[0]
  const cells = buildP3BlendCells(graph, page.id)
  renderer.presentationColorSpace = 'srgb'
  renderer.useDocumentColorSpace(space)
  renderer.pageId = page.id
  renderer.viewportWidth = WIDTH
  renderer.viewportHeight = HEIGHT
  renderer.showRulers = false
  render(renderer, graph, new Set(), {}, 1, 'full')
  return { renderer, cells }
}

function screenPixel(renderer: SkiaRenderer, x: number, y: number): number[] {
  const image = renderer.surface.makeImageSnapshot()
  try {
    const pixels = expectDefined(
      image.readPixels(Math.floor(x), Math.floor(y), {
        width: 1,
        height: 1,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      }),
      'pixels'
    )
    return Array.from(pixels.subarray(0, 3))
  } finally {
    image.delete()
  }
}

describe('drawing a document in another color space than the screen', () => {
  test('a Display P3 document blends in P3, as Figma does, and the screen shows the result', () => {
    const { renderer, cells } = drawOnSRGBScreen('display-p3')
    expect(renderer.documentSurface?.space).toBe('display-p3')
    for (const { x, y, expected } of cells) {
      const [r, g, b] = expected.map((channel) => channel / 255)
      const shown = toExtendedSRGB({ r, g, b, a: 1 }, 'display-p3')
      const actual = screenPixel(renderer, x, y)
      // Color burn divides, and the P3 result is rounded to 8 bits before it is converted.
      ;[shown.r, shown.g, shown.b].forEach((channel, index) =>
        expect(Math.abs(actual[index] - Math.max(0, channel) * 255)).toBeLessThanOrEqual(3)
      )
    }
  })

  test('a document in the screen color space draws on the screen itself', () => {
    const { renderer } = drawOnSRGBScreen('srgb')
    expect(renderer.documentSurface).toBeNull()
  })
})
