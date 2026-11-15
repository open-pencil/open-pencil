import { afterAll, describe, expect, test } from 'bun:test'

import { effect, solid } from '#core-tests/canvas/blur/helpers'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { renderNodesToImage } from '@open-pencil/core/io/formats/raster'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { minOf } from '@open-pencil/scene-graph/arrays'
import { expectDefined } from '@open-pencil/test-support/assert'

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

describe('a frame casting its drop shadow from a child past its box', () => {
  const childRight = 100 + 60 + 100

  /** Alpha just past the child's right edge, on a row through its middle. */
  function shadowRow(props: Partial<SceneNode>): number[] {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const frame = graph.createNode('FRAME', page, {
      width: 400,
      height: 400,
      fills: [],
      clipsContent: false
    })
    const parent = graph.createNode('FRAME', frame.id, {
      x: 100,
      y: 100,
      width: 40,
      height: 40,
      fills: [],
      clipsContent: false,
      ...props
    })
    graph.createNode('RECTANGLE', parent.id, {
      x: 60,
      width: 100,
      height: 40,
      fills: [solid(0, 0, 1)]
    })
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
        image.readPixels(0, 0, {
          width: image.width(),
          height: image.height(),
          alphaType: ck.AlphaType.Unpremul,
          colorType: ck.ColorType.RGBA_8888,
          colorSpace: ck.ColorSpace.SRGB
        })
      )
      const offset = (image.width() - 400) / 2
      const row: number[] = []
      for (let x = childRight + 2; x <= childRight + 10; x++) {
        row.push(pixels[((120 + offset) * image.width() + x + offset) * 4 + 3])
      }
      return row
    } finally {
      image.delete()
    }
  }

  const shadow = effect('DROP_SHADOW', 20)
  const unlayered = shadowRow({ effects: [shadow] })

  test('casts a visible shadow past the child without a layer', () => {
    expect(minOf(unlayered)).toBeGreaterThan(25)
  })

  test('keeps the shadow past the child at 0.6 opacity', () => {
    for (const [i, alpha] of shadowRow({ opacity: 0.6, effects: [shadow] }).entries()) {
      expect(Math.abs(alpha - unlayered[i] * 0.6)).toBeLessThanOrEqual(3)
    }
  })

  test('keeps the shadow past the child under a layer blur', () => {
    for (const [i, alpha] of shadowRow({
      effects: [shadow, effect('LAYER_BLUR', 1)]
    }).entries()) {
      expect(Math.abs(alpha - unlayered[i])).toBeLessThanOrEqual(6)
    }
  })
})
