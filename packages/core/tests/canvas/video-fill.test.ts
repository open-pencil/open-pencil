import { describe, expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { renderNodesToImage } from '@open-pencil/core/io/formats/raster'
import { SceneGraph, type Fill, type SceneNode, type Stroke } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { expectRgbaPixels } from './helpers'

const ck = await getCanvasKit()

const POSTER = 'video-poster-frame'
const CLIP = 'a'.repeat(40)
const SIZE = 20
const GREEN = [0, 255, 0, 255]
const BLUE = [0, 0, 255, 255]
const RED = [255, 0, 0, 255]

function posterBytes(): Uint8Array {
  const surface = expectDefined(ck.MakeSurface(40, 20), 'poster surface')
  const canvas = surface.getCanvas()
  canvas.clear(ck.GREEN)
  const blue = new ck.Paint()
  blue.setColor(ck.BLUE)
  canvas.drawRect(ck.XYWHRect(25, 0, 15, 20), blue)
  blue.delete()
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
    width: SIZE,
    height: SIZE,
    fills: []
  })
  graph.createNode('RECTANGLE', frame.id, {
    width: SIZE,
    height: SIZE,
    fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
  })
  graph.createNode('RECTANGLE', frame.id, { width: SIZE, height: SIZE, fills: [], ...paints })
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
        width: SIZE,
        height: SIZE
      })
    )
    image.delete()
    return (x: number, y: number) =>
      Array.from(pixels.subarray((y * SIZE + x) * 4, (y * SIZE + x) * 4 + 4))
  } finally {
    renderer.destroy()
  }
}

describe('video paints', () => {
  test('a filling video covers the layer with its poster, cropped to the middle', () => {
    const pixel = pixelsOverRedSquare({ fills: [video] })

    expect([pixel(2, 2), pixel(13, 17)]).toEqual([GREEN, GREEN])
    expect([pixel(17, 2), pixel(18, 17)]).toEqual([BLUE, BLUE])
  })

  test('a fitting video letterboxes its poster over the layers under it', () => {
    const pixel = pixelsOverRedSquare({ fills: [{ ...video, imageScaleMode: 'FIT' }] })

    expect([pixel(10, 1), pixel(10, 18)]).toEqual([RED, RED])
    expect([pixel(2, 10), pixel(17, 10)]).toEqual([GREEN, BLUE])
  })

  test('a cropped video draws the window its transform picks', () => {
    const rightHalf = { m00: 0.5, m01: 0, m02: 0.5, m10: 0, m11: 1, m12: 0 }
    const pixel = pixelsOverRedSquare({
      fills: [{ ...video, imageScaleMode: 'CROP', imageTransform: rightHalf }]
    })

    expect([pixel(2, 2), pixel(7, 17)]).toEqual([GREEN, BLUE])
  })

  test('a video stroke draws its poster where the stroke is', () => {
    const stroke: Stroke = { ...video, weight: 4, align: 'INSIDE' }
    const pixel = pixelsOverRedSquare({ strokes: [stroke], strokeWeight: 4, strokeAlign: 'INSIDE' })

    expect([pixel(1, 10), pixel(18, 10)]).toEqual([GREEN, BLUE])
    expect(pixel(10, 10)).toEqual(RED)
  })
})
