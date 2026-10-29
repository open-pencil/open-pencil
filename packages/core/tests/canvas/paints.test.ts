import { afterAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import { SceneGraph, type Fill, type SceneNode } from '@open-pencil/scene-graph'
import { DEFAULT_GRADIENT_TRANSFORM } from '@open-pencil/scene-graph/gradient'

const WIDTH = 400
const HEIGHT = 40

const ck = await initCanvasKit()
const surface = expectDefined(ck.MakeSurface(WIDTH, HEIGHT), 'surface')
const renderer = new SkiaRenderer(ck, surface)
afterAll(() => renderer.destroy())

const RED = { r: 1, g: 0, b: 0, a: 1 }
const BLUE = { r: 0, g: 0, b: 1, a: 1 }

const gradient: Fill = {
  type: 'GRADIENT_LINEAR',
  color: RED,
  opacity: 1,
  visible: true,
  gradientStops: [
    { position: 0, color: RED },
    { position: 1, color: BLUE }
  ],
  gradientTransform: { ...DEFAULT_GRADIENT_TRANSFORM }
}

/** Draws a rectangle alone on a cleared surface and returns its pixels. */
function draw(fields: Partial<SceneNode>): Uint8Array | Float32Array {
  const graph = new SceneGraph()
  const node = graph.createNode('RECTANGLE', graph.getPages()[0].id, fields)
  const canvas = surface.getCanvas()
  canvas.clear(ck.TRANSPARENT)
  renderer.renderShape(canvas, node, graph)
  surface.flush()
  const image = surface.makeImageSnapshot()
  try {
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
    return pixels
  } finally {
    image.delete()
  }
}

function paintsAnything(fields: Partial<SceneNode>): boolean {
  return draw(fields).some((value, index) => index % 4 === 3 && value > 0)
}

function colorAt(pixels: Uint8Array | Float32Array, x: number, y: number): number[] {
  const offset = (y * WIDTH + x) * 4
  return Array.from(pixels.slice(offset, offset + 4))
}

// A layer with no width or height, such as a straight line, used to scale the gradient's unit
// square to nothing, and a transform that is not a matrix gives NaN. CanvasKit builds no shader
// for either, and the renderer threw on every frame and stopped the canvas.
describe('a gradient on a layer with no height or with a broken transform', () => {
  test('a fill on a layer with no height paints nothing and does not throw', () => {
    expect(paintsAnything({ width: WIDTH, height: 0, fills: [gradient] })).toBe(false)
  })

  test('a stroke runs along a line with no height', () => {
    const leftToRight = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
    const stroke = {
      ...gradient,
      gradientTransform: leftToRight,
      weight: 4,
      align: 'CENTER' as const
    }
    const pixels = draw({ width: WIDTH, height: 0, fills: [], strokes: [stroke], strokeWeight: 4 })
    const [startRed, , startBlue, startAlpha] = colorAt(pixels, 4, 1)
    const [endRed, , endBlue, endAlpha] = colorAt(pixels, WIDTH - 5, 1)
    expect(startAlpha).toBe(255)
    expect(endAlpha).toBe(255)
    expect(startRed).toBeGreaterThan(240)
    expect(startBlue).toBeLessThan(15)
    expect(endBlue).toBeGreaterThan(240)
    expect(endRed).toBeLessThan(15)
  })

  test('draws nothing when its transform holds no numbers, rather than the paint colour', () => {
    const nan = Number.NaN
    const broken: Fill = {
      ...gradient,
      gradientTransform: { m00: nan, m01: nan, m02: nan, m10: nan, m11: nan, m12: nan }
    }
    expect(paintsAnything({ width: WIDTH, height: HEIGHT, fills: [broken] })).toBe(false)
    expect(
      paintsAnything({
        width: WIDTH,
        height: HEIGHT,
        fills: [],
        strokes: [{ ...broken, weight: 4, align: 'CENTER' }],
        strokeWeight: 4
      })
    ).toBe(false)
  })

  test('a solid stroke on a layer with no height still draws', () => {
    const stroke = { type: 'SOLID' as const, color: RED, opacity: 1, visible: true }
    expect(
      paintsAnything({
        width: WIDTH,
        height: 0,
        fills: [],
        strokes: [{ ...stroke, weight: 4, align: 'CENTER' }],
        strokeWeight: 4
      })
    ).toBe(true)
  })
})

// An image paint has no shader until its bytes are decoded. A fill waits for it, and a stroke used
// to draw in its paint's colour meanwhile, black for most imported strokes.
describe('an image paint whose image is not decoded yet', () => {
  const image: Fill = {
    type: 'IMAGE',
    color: { r: 0, g: 0, b: 0, a: 1 },
    opacity: 1,
    visible: true,
    imageHash: 'not-decoded',
    imageScaleMode: 'FILL'
  }

  test('a fill draws nothing', () => {
    expect(paintsAnything({ width: WIDTH, height: HEIGHT, fills: [image] })).toBe(false)
  })

  test('a stroke draws nothing rather than its colour', () => {
    expect(
      paintsAnything({
        width: WIDTH,
        height: HEIGHT,
        fills: [],
        strokes: [{ ...image, weight: 4, align: 'CENTER' }],
        strokeWeight: 4
      })
    ).toBe(false)
  })
})
