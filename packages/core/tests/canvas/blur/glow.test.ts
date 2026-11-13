import { afterAll, describe, expect, test } from 'bun:test'

import { effect, solid } from '#core-tests/canvas/blur/helpers'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { renderNodesToImage } from '@open-pencil/core/io/formats/raster'
import { SceneGraph, type Effect } from '@open-pencil/scene-graph'
import { minOf } from '@open-pencil/scene-graph/arrays'
import { drawnBlurRadius } from '@open-pencil/scene-graph/geometry'
import { expectDefined } from '@open-pencil/test-support/assert'

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

describe('a layer blur on a glowing dot', () => {
  const glow: Effect = {
    ...effect('DROP_SHADOW', 8),
    spread: 8,
    color: { r: 1, g: 0.1, b: 0, a: 1 },
    showShadowBehindNode: true
  }
  const dotRight = 53
  const oldLayerRight = dotRight + 2 * drawnBlurRadius(1)
  const margin = 3
  const rowStart = 50

  /** Alpha from `rowStart` rightward, on the row through the centre of a 6px dot in an instance. */
  function glowRow(effects: Effect[]): number[] {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const component = graph.createNode('COMPONENT', page, {
      x: 300,
      width: 16,
      height: 16,
      fills: [],
      clipsContent: false
    })
    graph.createNode('ELLIPSE', component.id, {
      x: 5,
      y: 5,
      width: 6,
      height: 6,
      fills: [solid(1, 0.8, 0.6)],
      effects
    })
    const frame = graph.createNode('FRAME', page, {
      width: 100,
      height: 100,
      fills: [],
      clipsContent: false
    })
    expectDefined(graph.createInstance(component.id, frame.id, { x: 42, y: 42 }))
    const png = expectDefined(
      renderNodesToImage(ck, renderer, graph, page, [frame.id], {
        scale: 1,
        format: 'PNG',
        trimTransparent: false
      })
    )
    const image = expectDefined(ck.MakeImageFromEncoded(png))
    try {
      const offset = (image.width() - 100) / 2
      const pixels = expectDefined(
        image.readPixels(0, 0, {
          width: image.width(),
          height: image.height(),
          alphaType: ck.AlphaType.Unpremul,
          colorType: ck.ColorType.RGBA_8888,
          colorSpace: ck.ColorSpace.SRGB
        })
      )
      const row: number[] = []
      for (let x = rowStart; x <= 76; x++) {
        row.push(pixels[((50 + offset) * image.width() + x + offset) * 4 + 3])
      }
      return row
    } finally {
      image.delete()
    }
  }

  test('blurs its halo beyond the dot instead of cutting it at the dot box', () => {
    const halo = glowRow([glow])
    const blurred = glowRow([glow, effect('FOREGROUND_BLUR', 1)])
    const firstPastOldLayer = oldLayerRight + margin - rowStart
    const pastOldLayer = blurred.slice(firstPastOldLayer, firstPastOldLayer + 4)
    expect(minOf(pastOldLayer)).toBeGreaterThan(90)
    for (const [i, alpha] of blurred.entries()) {
      expect(Math.abs(alpha - halo[i])).toBeLessThanOrEqual(4)
    }
  })
})
