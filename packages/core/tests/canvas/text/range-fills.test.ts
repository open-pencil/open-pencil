import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { type Fill, SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'
import { repoPath } from '@open-pencil/test-support/paths'

import { SkiaRenderer } from '#core/canvas/renderer/skia'
import { fontManager } from '#core/text/font/manager'

const FONT_FAMILY = 'Range fills fixture'
const WIDTH = 240
const HEIGHT = 60
const TEXT = 'MM MM'
/** The characters after the space, which the style run covers. */
const RANGE = { start: 3, length: 2 }
const CHANNEL_TOLERANCE = 2

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(WIDTH, HEIGHT), 'surface'))

beforeAll(async () => {
  const data = await Bun.file(repoPath('packages/core/assets/InterVariable.ttf')).arrayBuffer()
  await fontManager.markLoaded(FONT_FAMILY, 'Regular', data)
  await renderer.loadFonts()
})
afterAll(() => renderer.destroy())

function solid(r: number, g: number, b: number, opacity = 1): Fill {
  return { type: 'SOLID', color: { r, g, b, a: 1 }, opacity, visible: true }
}

const black = solid(0, 0, 0)
const green = solid(0, 0.8, 0)

function gradient(opacity = 1): Fill {
  return {
    ...black,
    type: 'GRADIENT_LINEAR',
    opacity,
    gradientStops: [
      { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
      { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
    ],
    gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
  }
}

/** An image fill whose image the graph does not hold, so it draws nothing. */
const missingImage: Fill = {
  ...black,
  type: 'IMAGE',
  imageHash: '0'.repeat(40),
  imageScaleMode: 'FILL'
}

/** The text drawn on a transparent canvas, as unpremultiplied RGBA. */
function draw(fills: Fill[], rangeFills?: Fill[]): ArrayLike<number> {
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'page')
  graph.createNode('TEXT', page.id, {
    text: TEXT,
    fontFamily: FONT_FAMILY,
    fontSize: 40,
    width: WIDTH,
    height: HEIGHT,
    fills,
    styleRuns: rangeFills ? [{ ...RANGE, style: { fills: rangeFills } }] : []
  })
  renderer.pageId = page.id
  const canvas = renderer.surface.getCanvas()
  canvas.clear(ck.TRANSPARENT)
  renderer.renderSceneToCanvas(canvas, graph, page.id)
  renderer.surface.flush()
  const image = renderer.surface.makeImageSnapshot()
  try {
    return expectDefined(
      image.readPixels(0, 0, {
        width: WIDTH,
        height: HEIGHT,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      }),
      'pixels'
    )
  } finally {
    image.delete()
  }
}

function inked(rgba: ArrayLike<number>, x: number): boolean {
  for (let y = 0; y < HEIGHT; y++) if ((rgba[(y * WIDTH + x) * 4 + 3] ?? 0) > 0) return true
  return false
}

/** The middle of the space between the words: left of it the layer's characters, right the run. */
function rangeStart(rgba: ArrayLike<number>): number {
  let best = { start: 0, length: 0 }
  let start = -1
  for (let x = 0; x <= WIDTH; x++) {
    const empty = x < WIDTH && !inked(rgba, x)
    if (empty && start < 0) start = x
    if (!empty && start >= 0) {
      const gap = { start, length: x - start }
      // The gap between the words, not the margin after them.
      if (x < WIDTH && start > 0 && gap.length > best.length) best = gap
      start = -1
    }
  }
  expect(best.length).toBeGreaterThan(0)
  return best.start + Math.floor(best.length / 2)
}

/** The largest difference of any channel between the two images, over columns `from`–`to`. */
function difference(a: ArrayLike<number>, b: ArrayLike<number>, from: number, to: number): number {
  let largest = 0
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = from; x < to; x++) {
      for (let channel = 0; channel < 4; channel++) {
        const index = (y * WIDTH + x) * 4 + channel
        largest = Math.max(largest, Math.abs((a[index] ?? 0) - (b[index] ?? 0)))
      }
    }
  }
  return largest
}

/**
 * Expects the text with `rangeFills` on its second word to draw that word as the text whose layer
 * has `rangeFills` does, and its first word as the text whose layer has `fills` does.
 */
function expectRangeDrawnAsLayer(fills: Fill[], rangeFills: Fill[]): void {
  const ranged = draw(fills, rangeFills)
  const layer = draw(fills)
  const range = draw(rangeFills)
  const split = rangeStart(layer)
  expect(difference(ranged, layer, 0, split)).toBeLessThanOrEqual(CHANNEL_TOLERANCE)
  expect(difference(ranged, range, split, WIDTH)).toBeLessThanOrEqual(CHANNEL_TOLERANCE)
}

describe('style runs with fills of their own', () => {
  test('a gradient on a range spans the layer', () => {
    expectRangeDrawnAsLayer([black], [gradient()])
  })

  test("a range's fills stack as a layer's do", () => {
    expectRangeDrawnAsLayer([black], [green, gradient(0.5)])
  })

  test('a solid range keeps its colour on a gradient layer', () => {
    expectRangeDrawnAsLayer([gradient()], [green])
  })

  test('a translucent range is painted once, whatever fills the layer has', () => {
    expectRangeDrawnAsLayer([black, solid(1, 0, 0, 0.5)], [solid(0, 0, 1, 0.5)])
  })

  test('a range whose fills are empty or hidden draws nothing', () => {
    expectRangeDrawnAsLayer([black], [])
    expectRangeDrawnAsLayer([black], [{ ...green, visible: false }])
  })

  test("a range draws when the layer's first fill has nothing to draw yet", () => {
    expectRangeDrawnAsLayer([missingImage, black], [gradient()])
  })

  test('a range of one solid fill on a solid layer takes its colour', () => {
    expectRangeDrawnAsLayer([black], [green])
  })
})
