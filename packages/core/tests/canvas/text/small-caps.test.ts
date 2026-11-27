import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { SceneGraph, type TextCase } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'
import { repoPath } from '@open-pencil/test-support/paths'

import { SkiaRenderer } from '#core/canvas/renderer/skia'
import { fontFeaturesSync } from '#core/text/font/features'
import { fontManager } from '#core/text/font/manager'

// A test font of boxes: lower case 500 units tall, capitals 700, and small capitals 600, which
// its `smcp` puts in place of lower case and its `c2sc` in place of capitals.
const FAMILY = 'Small Caps Test'
const SIZE = 120
const FONT_SIZE = 100

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(SIZE * 4, SIZE), 'surface'))

beforeAll(async () => {
  const data = await Bun.file(repoPath('tests/fixtures/fonts/SmallCapsTest.ttf')).arrayBuffer()
  await fontManager.markLoaded(FAMILY, 'Regular', data)
  await renderer.loadFonts()
})
afterAll(() => renderer.destroy())

/** How tall the ink of `text` in `textCase` is, in pixels. */
function inkHeight(text: string, textCase: TextCase): number {
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'page')
  graph.createNode('TEXT', page.id, {
    text,
    textCase,
    fontFamily: FAMILY,
    fontSize: FONT_SIZE,
    width: SIZE * 4,
    height: SIZE
  })
  renderer.pageId = page.id
  const canvas = renderer.surface.getCanvas()
  canvas.clear(ck.TRANSPARENT)
  renderer.renderSceneToCanvas(canvas, graph, page.id)
  renderer.surface.flush()
  const image = renderer.surface.makeImageSnapshot()
  try {
    const width = SIZE * 4
    const rgba = expectDefined(
      image.readPixels(0, 0, {
        width,
        height: SIZE,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      }),
      'pixels'
    )
    const inked = (y: number) => {
      for (let x = 0; x < width; x++) if ((rgba[(y * width + x) * 4 + 3] ?? 0) > 127) return true
      return false
    }
    let rows = 0
    for (let y = 0; y < SIZE; y++) if (inked(y)) rows++
    return rows
  } finally {
    image.delete()
  }
}

describe('small caps', () => {
  test('the font offers them, as the panel reads its features', () => {
    const tags = fontFeaturesSync(FAMILY, 'Regular')?.map((feature) => feature.tag)
    expect(tags).toEqual(expect.arrayContaining(['smcp', 'c2sc']))
  })

  test("draw lower case in the font's small capitals", () => {
    expect(inkHeight('abc', 'ORIGINAL')).toBe(50)
    expect(inkHeight('abc', 'SMALL_CAPS')).toBe(60)
  })

  test('leave capitals as they are, unless forced', () => {
    expect(inkHeight('ABC', 'SMALL_CAPS')).toBe(70)
    expect(inkHeight('ABC', 'SMALL_CAPS_FORCED')).toBe(60)
  })
})
