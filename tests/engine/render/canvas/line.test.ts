import { beforeAll, describe, expect, test } from 'bun:test'

import { renderNodesToImage, SceneGraph, SkiaRenderer } from '@inkly/core'

import { initCanvasKit } from '#cli/headless'

import { expectDefined } from '#tests/helpers/assert'

let ck: Awaited<ReturnType<typeof initCanvasKit>>

beforeAll(async () => {
  ck = await initCanvasKit()
})

describe('line rendering', () => {
  test('rotates lines around their transform origin', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      width: 40,
      height: 40
    })
    graph.createNode('LINE', frame.id, {
      x: 10,
      y: 8,
      width: 24,
      height: 0,
      rotation: 90,
      strokes: [
        {
          color: { r: 0, g: 0, b: 0, a: 1 },
          weight: 1,
          opacity: 1,
          visible: true,
          align: 'CENTER'
        }
      ]
    })

    const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
    const renderer = new SkiaRenderer(ck, surface)

    try {
      const png = expectDefined(
        renderNodesToImage(ck, renderer, graph, page.id, [frame.id], {
          scale: 1,
          format: 'PNG'
        }),
        'line png'
      )
      const image = expectDefined(ck.MakeImageFromEncoded(png), 'line image')
      const pixels = expectDefined(
        image.readPixels(0, 0, {
          width: image.width(),
          height: image.height(),
          colorType: ck.ColorType.RGBA_8888,
          alphaType: ck.AlphaType.Unpremul,
          colorSpace: ck.ColorSpace.SRGB
        }),
        'line pixels'
      )
      const width = image.width()
      const alphaAt = (x: number, y: number) => pixels[(y * width + x) * 4 + 3]

      expect(alphaAt(10, 36)).toBeGreaterThan(0)
      expect(alphaAt(22, 36)).toBe(0)

      image.delete()
    } finally {
      surface.delete()
    }
  })
})
