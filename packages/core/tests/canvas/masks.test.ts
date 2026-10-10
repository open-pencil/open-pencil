import { afterAll, describe, expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core'
import { initCanvasKit, renderNodesToImage } from '@open-pencil/core/io'
import { SceneGraph, type MaskType, type SceneNode } from '@open-pencil/scene-graph'

import { expectDefined } from '../helpers/assert'

const ck = await initCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

const solid = (r: number, g: number, b: number, opacity = 1) => ({
  type: 'SOLID' as const,
  color: { r, g, b, a: 1 },
  opacity,
  visible: true
})

/** The alpha of a red square masked by an 80px ellipse, at the centre of the 100px frame. */
function maskedAlpha(maskType: MaskType, mask: Partial<SceneNode>): number {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const frame = graph.createNode('FRAME', page, { width: 100, height: 100, fills: [] })
  const group = graph.createNode('GROUP', frame.id, { width: 100, height: 100 })
  graph.createNode('ELLIPSE', group.id, {
    x: 10,
    y: 10,
    width: 80,
    height: 80,
    fills: [maskType === 'LUMINANCE' ? solid(1, 1, 1) : solid(0, 0, 0)],
    isMask: true,
    maskType,
    ...mask
  })
  graph.createNode('RECTANGLE', group.id, { width: 100, height: 100, fills: [solid(1, 0, 0)] })
  const png = expectDefined(
    renderNodesToImage(ck, renderer, graph, page, [frame.id], {
      scale: 1,
      format: 'PNG',
      trimTransparent: false
    })
  )
  const image = expectDefined(ck.MakeImageFromEncoded(png))
  try {
    const pixels = expectDefined(
      image.readPixels(50, 50, {
        width: 1,
        height: 1,
        alphaType: ck.AlphaType.Unpremul,
        colorType: ck.ColorType.RGBA_8888,
        colorSpace: ck.ColorSpace.SRGB
      })
    )
    return pixels[3]
  } finally {
    image.delete()
  }
}

// Values read from Figma 126 exports of the same scene.
describe('a mask draws what it masks as Figma does', () => {
  test('through its opacity, which a luminance mask applies twice', () => {
    expect(maskedAlpha('ALPHA', { opacity: 0.5 })).toBe(128)
    expect(maskedAlpha('VECTOR', { opacity: 0.5 })).toBe(128)
    expect(maskedAlpha('LUMINANCE', { opacity: 0.5 })).toBe(64)
  })

  test('with an outline mask ignoring how opaque its fill is', () => {
    expect(maskedAlpha('ALPHA', { fills: [solid(0, 0, 0, 0.5)] })).toBe(128)
    expect(maskedAlpha('VECTOR', { fills: [solid(0, 0, 0, 0.5)] })).toBe(255)
  })

  test('without its blend mode', () => {
    for (const maskType of ['ALPHA', 'VECTOR', 'LUMINANCE'] as const) {
      expect(maskedAlpha(maskType, { blendMode: 'MULTIPLY' })).toBe(255)
    }
  })
})
