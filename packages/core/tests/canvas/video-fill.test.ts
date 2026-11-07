import { beforeAll, describe, expect, test } from 'bun:test'

import type { CanvasKit } from 'canvaskit-wasm'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit, renderNodesToImage } from '@open-pencil/core/io/formats/raster'
import { SceneGraph, type Fill, type SceneNode, type Stroke } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { expectRgbaPixels } from './helpers'

let ck: CanvasKit

beforeAll(async () => {
  ck = await initCanvasKit()
})

const POSTER = 'video-poster-frame'
const CLIP = 'a'.repeat(40)
const GREEN = [0, 255, 0, 255]
const RED = { r: 1, g: 0, b: 0, a: 1 }

function posterBytes(): Uint8Array {
  const surface = expectDefined(ck.MakeSurface(4, 4), 'poster surface')
  surface.getCanvas().clear(ck.GREEN)
  const image = surface.makeImageSnapshot()
  const bytes = expectDefined(image.encodeToBytes(ck.ImageFormat.PNG, 100), 'poster PNG')
  image.delete()
  surface.delete()
  return bytes
}

const video: Fill = {
  type: 'VIDEO',
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  imageHash: POSTER,
  videoHash: CLIP,
  imageScaleMode: 'FILL'
}

function pixelsOverRedSquare(
  paints: Partial<Pick<SceneNode, 'fills' | 'strokes' | 'strokeWeight' | 'strokeAlign'>>
) {
  const graph = new SceneGraph()
  graph.images.set(POSTER, posterBytes())
  const frame = graph.createNode('FRAME', graph.getPages()[0].id, {
    width: 20,
    height: 20,
    fills: []
  })
  graph.createNode('RECTANGLE', frame.id, {
    width: 20,
    height: 20,
    fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: true }]
  })
  graph.createNode('RECTANGLE', frame.id, { width: 20, height: 20, fills: [], ...paints })
  const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
  const renderer = new SkiaRenderer(ck, surface)
  try {
    const png = expectDefined(
      renderNodesToImage(ck, renderer, graph, graph.getPages()[0].id, [frame.id], {
        scale: 1,
        format: 'PNG'
      }),
      'png'
    )
    const image = expectDefined(ck.MakeImageFromEncoded(png), 'image')
    const pixels = expectRgbaPixels(
      image.readPixels(0, 0, {
        alphaType: ck.AlphaType.Unpremul,
        colorType: ck.ColorType.RGBA_8888,
        colorSpace: ck.ColorSpace.SRGB,
        width: 20,
        height: 20
      })
    )
    image.delete()
    return (x: number, y: number) =>
      Array.from(pixels.subarray((y * 20 + x) * 4, (y * 20 + x) * 4 + 4))
  } finally {
    renderer.destroy()
  }
}

describe('video paints', () => {
  test('a video fill draws its poster frame over the layers under it', () => {
    const pixel = pixelsOverRedSquare({ fills: [video] })

    expect(pixel(10, 10)).toEqual(GREEN)
    expect(pixel(0, 19)).toEqual(GREEN)
  })

  test('a video stroke draws its poster frame', () => {
    const stroke: Stroke = { ...video, weight: 4, align: 'INSIDE' }
    const pixel = pixelsOverRedSquare({ strokes: [stroke], strokeWeight: 4, strokeAlign: 'INSIDE' })

    expect(pixel(1, 10)).toEqual(GREEN)
    expect(pixel(10, 10)).toEqual([255, 0, 0, 255])
  })
})
