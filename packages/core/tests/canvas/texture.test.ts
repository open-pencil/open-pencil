import { afterAll, describe, expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { renderNodesToImage } from '@open-pencil/core/io/formats/raster'
import { texture } from '@open-pencil/design-jsx'
import { SceneGraph, type Fill } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

/**
 * How many pixels of a 120 px blue square inside a 160 px white frame lie outside the square, and
 * how many inside it are missing, with `clipToShape` set as given.
 */
function roughened(clipToShape: boolean) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const host = graph.createNode('FRAME', page, {
    width: 160,
    height: 160,
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
  })
  graph.createNode('RECTANGLE', host.id, {
    x: 20,
    y: 20,
    width: 120,
    height: 120,
    fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1, visible: true }],
    effects: [texture({ noiseSize: 2, radius: 4, clipToShape })]
  })
  const png = renderNodesToImage(ck, renderer, graph, page, [host.id], { scale: 1, format: 'PNG' })
  const image = expectDefined(ck.MakeImageFromEncoded(expectDefined(png)))
  try {
    const pixels = expectDefined(
      image.readPixels(0, 0, {
        width: 160,
        height: 160,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      })
    )
    let outside = 0
    let missing = 0
    for (let y = 0; y < 160; y++) {
      for (let x = 0; x < 160; x++) {
        const blue = 1 - pixels[(y * 160 + x) * 4] / 255
        const inSquare = x >= 20 && x < 140 && y >= 20 && y < 140
        if (inSquare) missing += 1 - blue
        else outside += blue
      }
    }
    return { outside, missing }
  } finally {
    image.delete()
  }
}

// Figma 126 exports of the same square, texture of size 2 and radius 4: unclipped, about 200 px
// of blue spill past the edges and as much is lost inside; clipped, both stay near zero.
describe('texture effects', () => {
  test('roughen the edges outward and inward unless clipped to the shape', () => {
    const loose = roughened(false)
    expect(loose.outside).toBeGreaterThan(120)
    expect(loose.missing).toBeGreaterThan(120)
    const clipped = roughened(true)
    expect(clipped.outside).toBeLessThan(40)
    expect(clipped.missing).toBeLessThan(40)
  })

  test('keep a clipped texture out of a boolean’s hole', () => {
    const blue: Fill = {
      type: 'SOLID',
      color: { r: 0, g: 0, b: 1, a: 1 },
      opacity: 1,
      visible: true
    }
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const host = graph.createNode('FRAME', page, {
      width: 160,
      height: 160,
      fills: [{ ...blue, color: { r: 1, g: 1, b: 1, a: 1 } }]
    })
    const ring = graph.createNode('BOOLEAN_OPERATION', host.id, {
      x: 20,
      y: 20,
      width: 120,
      height: 120,
      booleanOperation: 'SUBTRACT',
      fills: [blue],
      effects: [texture({ noiseSize: 2, radius: 6, clipToShape: true })]
    })
    graph.createNode('RECTANGLE', ring.id, { width: 120, height: 120, fills: [blue] })
    graph.createNode('RECTANGLE', ring.id, { x: 30, y: 30, width: 60, height: 60, fills: [blue] })
    const png = renderNodesToImage(ck, renderer, graph, page, [host.id], {
      scale: 1,
      format: 'PNG'
    })
    const image = expectDefined(ck.MakeImageFromEncoded(expectDefined(png)))
    const pixels = expectDefined(
      image.readPixels(0, 0, {
        width: 160,
        height: 160,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      })
    )
    image.delete()
    // The hole spans 50 to 110 on both axes; the displaced ring must stay out of it.
    let inHole = 0
    for (let y = 50; y < 110; y++) {
      for (let x = 50; x < 110; x++) inHole += 1 - pixels[(y * 160 + x) * 4] / 255
    }
    expect(inHole).toBeLessThan(20)
  })

  test('leave the layer’s own drop shadow whole when clipped to the shape', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const host = graph.createNode('FRAME', page, {
      width: 160,
      height: 160,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    graph.createNode('RECTANGLE', host.id, {
      x: 20,
      y: 20,
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1, visible: true }],
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 20, y: 20 },
          radius: 0,
          spread: 0,
          visible: true
        },
        texture({ noiseSize: 2, radius: 4, clipToShape: true })
      ]
    })
    const png = renderNodesToImage(ck, renderer, graph, page, [host.id], {
      scale: 1,
      format: 'PNG'
    })
    const image = expectDefined(ck.MakeImageFromEncoded(expectDefined(png)))
    try {
      const pixels = expectDefined(
        image.readPixels(0, 0, {
          width: 160,
          height: 160,
          colorType: ck.ColorType.RGBA_8888,
          alphaType: ck.AlphaType.Unpremul,
          colorSpace: ck.ColorSpace.SRGB
        })
      )
      // Below the square's right corner, only the shadow reaches: black, not the frame's white.
      const at = (130 * 160 + 130) * 4
      expect([pixels[at], pixels[at + 1], pixels[at + 2]]).toEqual([0, 0, 0])
    } finally {
      image.delete()
    }
  })
})
