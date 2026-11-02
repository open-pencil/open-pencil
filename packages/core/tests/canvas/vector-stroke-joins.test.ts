import { afterAll, describe, expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit, renderNodesToImage } from '@open-pencil/core/io/formats/raster'
import { SceneGraph, type VectorNetwork } from '@open-pencil/scene-graph'

import { expectDefined } from '../helpers/assert'

const ck = await initCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

const zero = { x: 0, y: 0 }

/** The alpha at a point of a 100px frame holding an unfilled L-shaped path, stroked 20 wide. */
function alphaAt(x: number, y: number, join: 'MITER' | 'BEVEL'): number {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const frame = graph.createNode('FRAME', page, {
    width: 100,
    height: 100,
    fills: [],
    clipsContent: false
  })
  // Right along the top, then down: (20, 20) → (80, 20) → (80, 80) in the frame.
  const network: VectorNetwork = {
    vertices: [
      { x: 0, y: 0 },
      { x: 60, y: 0 },
      { x: 60, y: 60 }
    ],
    segments: [
      { start: 0, end: 1, tangentStart: zero, tangentEnd: zero },
      { start: 1, end: 2, tangentStart: zero, tangentEnd: zero }
    ],
    regions: []
  }
  graph.createNode('VECTOR', frame.id, {
    x: 20,
    y: 20,
    width: 60,
    height: 60,
    vectorNetwork: network,
    fills: [],
    strokes: [
      {
        type: 'SOLID',
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 1,
        visible: true,
        weight: 20,
        align: 'CENTER',
        cap: 'NONE',
        join
      }
    ],
    strokeWeight: 20,
    strokeAlign: 'CENTER',
    strokeJoin: join,
    strokeCap: 'NONE'
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
    return pixels[((y + offset) * image.width() + x + offset) * 4 + 3]
  } finally {
    image.delete()
  }
}

describe('stroking a vector path', () => {
  test('a corner takes the stroke’s join, filling the outer corner with a miter', () => {
    // Outside the corner at (80, 20), where neither leg's own stroke reaches.
    expect(alphaAt(87, 13, 'MITER')).toBe(255)
  })

  test('a bevel cuts that corner off', () => {
    expect(alphaAt(88, 12, 'BEVEL')).toBe(0)
    // Inside the bevel, near the corner.
    expect(alphaAt(84, 16, 'BEVEL')).toBe(255)
  })
})
