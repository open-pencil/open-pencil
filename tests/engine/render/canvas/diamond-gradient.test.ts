import { expect, test } from 'bun:test'

import type { Fill } from '@open-pencil/scene-graph'
import { SceneGraph } from '@open-pencil/scene-graph'

import { initCanvasKit } from '#cli/headless'
import { SkiaRenderer } from '#core/canvas/renderer'

import { expectDefined } from '#tests/helpers/assert'

test('diamond contours use Manhattan distance and dispose their retained program', async () => {
  const ck = await initCanvasKit()
  const surface = expectDefined(ck.MakeSurface(101, 101), 'surface')
  const renderer = new SkiaRenderer(ck, surface)
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'page')
  const fill: Fill = {
    type: 'GRADIENT_DIAMOND',
    color: { r: 0, g: 0, b: 0, a: 1 },
    opacity: 1,
    visible: true,
    gradientStops: [
      { position: 0, color: { r: 0, g: 0, b: 0, a: 1 } },
      { position: 1, color: { r: 1, g: 1, b: 1, a: 1 } }
    ],
    gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
  }
  const node = graph.createNode('RECTANGLE', page.id, { width: 101, height: 101, fills: [fill] })
  let effect = renderer.diamondGradientEffect
  try {
    const draw = () => {
      const canvas = surface.getCanvas()
      canvas.clear(ck.TRANSPARENT)
      renderer.renderShape(canvas, node, graph)
      surface.flush()
    }
    draw()
    effect = renderer.diamondGradientEffect
    draw()
    expect(renderer.diamondGradientEffect).toBe(effect)
    const image = surface.makeImageSnapshot()
    try {
      const pixels = expectDefined(
        image.readPixels(0, 0, {
          width: 101,
          height: 101,
          colorType: ck.ColorType.RGBA_8888,
          alphaType: ck.AlphaType.Unpremul,
          colorSpace: ck.ColorSpace.SRGB
        }),
        'pixels'
      )
      const red = (x: number, y: number) => pixels[(y * 101 + x) * 4]
      expect(red(50, 50)).toBe(0)
      expect(red(75, 75)).toBe(red(100, 50))
      expect(red(75, 75)).toBeGreaterThan(245)
      expect(red(0, 0)).toBe(255)
      effect = expectDefined(effect, 'compiled effect')
    } finally {
      image.delete()
    }
  } finally {
    renderer.destroy()
  }
  expect(effect?.isDeleted()).toBe(true)
  expect(renderer.diamondGradientEffect).toBeNull()
})

test('diamond gradients preserve transformed contours and intermediate stops', async () => {
  const ck = await initCanvasKit()
  const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(100, 100), 'surface'))
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'page')
  const black = { r: 0, g: 0, b: 0, a: 1 }
  const fill: Fill = {
    type: 'GRADIENT_DIAMOND',
    color: black,
    opacity: 1,
    visible: true,
    gradientTransform: { m00: 0, m01: 2, m02: -0.51, m10: -1, m11: 0, m12: 1.005 },
    gradientStops: [
      { position: 0, color: black },
      { position: 0.5, color: { r: 1, g: 0, b: 0, a: 1 } },
      { position: 1, color: { r: 1, g: 1, b: 1, a: 1 } }
    ]
  }
  const node = graph.createNode('RECTANGLE', page.id, { width: 100, height: 100, fills: [fill] })
  try {
    const canvas = renderer.surface.getCanvas()
    canvas.clear(ck.TRANSPARENT)
    renderer.renderShape(canvas, node, graph)
    renderer.surface.flush()
    const image = renderer.surface.makeImageSnapshot()
    try {
      const pixels = expectDefined(
        image.readPixels(0, 0, {
          width: 100,
          height: 100,
          colorType: ck.ColorType.RGBA_8888,
          alphaType: ck.AlphaType.Unpremul,
          colorSpace: ck.ColorSpace.SRGB
        }),
        'pixels'
      )
      const pixel = (x: number, y: number) =>
        Array.from(pixels.slice((y * 100 + x) * 4, (y * 100 + x) * 4 + 4))
      expect(pixel(50, 50)).toEqual([0, 0, 0, 255])
      expect(pixel(50, 56)).toEqual([122, 0, 0, 255])
      expect(pixel(62, 50)).toEqual(pixel(50, 56))
      expect(pixel(50, 63)).toEqual([255, 10, 10, 255])
      expect(pixel(76, 50)).toEqual(pixel(50, 63))
      expect(pixel(50, 75)).toEqual([255, 255, 255, 255])
    } finally {
      image.delete()
    }
  } finally {
    renderer.destroy()
  }
})
