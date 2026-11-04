import { afterAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { flippedCases } from '#core-tests/helpers/flipped-layers'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import {
  computeContentBounds,
  initCanvasKit,
  renderNodesToImage,
  renderThumbnail,
  thumbnailFrame
} from '@open-pencil/core/io/formats/raster'
import type { VisualBounds } from '@open-pencil/scene-graph/geometry'

const ck = await initCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1), 'surface'))

afterAll(() => renderer.destroy())

function decode(png: Uint8Array) {
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
  return { width, height, pixels }
}

function opaqueBox({ width, height, pixels }: ReturnType<typeof decode>): VisualBounds | null {
  const box = { minX: width, minY: height, maxX: 0, maxY: 0 }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] < 128) {
        continue
      }
      box.minX = Math.min(box.minX, x)
      box.minY = Math.min(box.minY, y)
      box.maxX = Math.max(box.maxX, x + 1)
      box.maxY = Math.max(box.maxY, y + 1)
    }
  }
  return box.maxX > box.minX ? box : null
}

function expectBoxClose(actual: VisualBounds | null, expected: VisualBounds, within: number) {
  const box = expectDefined(actual, 'box')
  for (const side of ['minX', 'minY', 'maxX', 'maxY'] as const) {
    expect(Math.abs(box[side] - expected[side])).toBeLessThanOrEqual(within)
  }
}

function shifted(box: VisualBounds, by: VisualBounds): VisualBounds {
  return {
    minX: box.minX - by.minX,
    minY: box.minY - by.minY,
    maxX: box.maxX - by.minX,
    maxY: box.maxY - by.minY
  }
}

describe('raster export of flipped layers', () => {
  for (const layer of flippedCases()) {
    test(`${layer.name} is bounded by everything it covers`, () => {
      expectBoxClose(computeContentBounds(layer.graph, [layer.nodeId]), layer.bounds, 1e-6)
    })

    test(`${layer.name} keeps its pixels in the PNG`, () => {
      const png = expectDefined(
        renderNodesToImage(ck, renderer, layer.graph, layer.pageId, [layer.nodeId], {
          scale: 1,
          format: 'PNG'
        }),
        'png'
      )
      const image = decode(png)
      expect(image.width).toBe(Math.ceil(layer.bounds.maxX - layer.bounds.minX))
      expect(image.height).toBe(Math.ceil(layer.bounds.maxY - layer.bounds.minY))
      expectBoxClose(opaqueBox(image), shifted(layer.ink, layer.bounds), 1)
    })

    test(`${layer.name} alone on a page frames the page thumbnail`, () => {
      const frame = expectDefined(thumbnailFrame(layer.graph, layer.pageId, 200, 200), 'frame')
      expectBoxClose(frame.bounds, layer.bounds, 1e-6)
    })
  }

  test('a flipped layer alone on a page shows in its thumbnail', () => {
    const layer = expectDefined(
      flippedCases().find((entry) => entry.name === 'a rectangle flipped horizontally')
    )
    const png = expectDefined(
      renderThumbnail(ck, renderer, layer.graph, layer.pageId, 60, 20),
      'thumbnail'
    )
    const { pixels } = decode(png)
    const red = pixels.filter(
      (_, index) => index % 4 === 0 && pixels[index] > 200 && pixels[index + 1] < 60
    )
    expect(red.length).toBe(60 * 20)
  })
})
