import { afterAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import { SceneGraph, type BlendMode, type SceneNode } from '@open-pencil/scene-graph'

const SIZE = 120

const ck = await initCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(SIZE, SIZE), 'surface'))
afterAll(() => renderer.destroy())

const RED_FILL = [
  { type: 'SOLID' as const, color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
]

function greenStroke(blendMode: BlendMode) {
  return {
    type: 'SOLID' as const,
    color: { r: 0, g: 1, b: 0, a: 1 },
    opacity: 1,
    visible: true,
    weight: 10,
    align: 'INSIDE' as const,
    blendMode
  }
}

function squareVector(): SceneNode['vectorNetwork'] {
  return {
    vertices: [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 40 },
      { x: 0, y: 40 }
    ],
    segments: [0, 1, 2, 3].map((start) => ({
      start,
      end: (start + 1) % 4,
      tangentStart: { x: 0, y: 0 },
      tangentEnd: { x: 0, y: 0 }
    })),
    regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2, 3]] }]
  }
}

type Scene = (graph: SceneGraph, pageId: string) => void

function renderPixels(scene: Scene): Uint8Array {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  scene(graph, page.id)
  renderer.pageId = page.id
  const canvas = renderer.surface.getCanvas()
  canvas.clear(ck.TRANSPARENT)
  renderer.renderSceneToCanvas(canvas, graph, page.id)
  renderer.surface.flush()
  const image = renderer.surface.makeImageSnapshot()
  try {
    return Uint8Array.from(
      expectDefined(
        image.readPixels(0, 0, {
          width: SIZE,
          height: SIZE,
          colorType: ck.ColorType.RGBA_8888,
          alphaType: ck.AlphaType.Unpremul,
          colorSpace: ck.ColorSpace.SRGB
        }),
        'pixels'
      )
    )
  } finally {
    image.delete()
  }
}

function rgbAt(pixels: Uint8Array, x: number, y: number): number[] {
  const offset = (y * SIZE + x) * 4
  return Array.from(pixels.subarray(offset, offset + 3))
}

describe('a stroke paint blends with what is under it, as a fill paint does', () => {
  test('on a shape stroked by its outline', () => {
    const pixels = renderPixels((graph, pageId) => {
      graph.createNode('RECTANGLE', pageId, {
        x: 10,
        y: 10,
        width: 40,
        height: 40,
        fills: RED_FILL,
        strokes: [greenStroke('MULTIPLY')]
      })
    })
    expect(rgbAt(pixels, 12, 30)).toEqual([0, 0, 0])
    expect(rgbAt(pixels, 30, 30)).toEqual([255, 0, 0])
  })

  test('on a vector stroked by its path', () => {
    const pixels = renderPixels((graph, pageId) => {
      graph.createNode('VECTOR', pageId, {
        x: 10,
        y: 10,
        width: 40,
        height: 40,
        vectorNetwork: squareVector(),
        fills: RED_FILL,
        strokes: [greenStroke('MULTIPLY')]
      })
    })
    expect(rgbAt(pixels, 12, 30)).toEqual([0, 0, 0])
    expect(rgbAt(pixels, 30, 30)).toEqual([255, 0, 0])
  })

  test('by its own mode, so a normal stroke after a blended one covers what is under it', () => {
    const pixels = renderPixels((graph, pageId) => {
      graph.createNode('RECTANGLE', pageId, {
        x: 10,
        y: 10,
        width: 40,
        height: 40,
        fills: RED_FILL,
        strokes: [greenStroke('MULTIPLY'), { ...greenStroke('NORMAL'), weight: 4 }]
      })
      graph.createNode('RECTANGLE', pageId, {
        x: 60,
        y: 10,
        width: 40,
        height: 40,
        fills: RED_FILL,
        strokes: [greenStroke('NORMAL')]
      })
    })
    expect(rgbAt(pixels, 12, 30)).toEqual([0, 255, 0])
    expect(rgbAt(pixels, 17, 30)).toEqual([0, 0, 0])
    expect(rgbAt(pixels, 62, 30)).toEqual([0, 255, 0])
  })
})

test('a plus darker stroke adds itself to what is under it, less white', () => {
  const pixels = renderPixels((graph, pageId) => {
    graph.createNode('RECTANGLE', pageId, {
      x: 10,
      y: 10,
      width: 40,
      height: 40,
      fills: [{ ...RED_FILL[0], color: { r: 0.6, g: 0.4, b: 0.2, a: 1 } }],
      strokes: [{ ...greenStroke('LINEAR_BURN'), color: { r: 0.2, g: 0.8, b: 0.7, a: 1 } }]
    })
  })
  const burned = [0, 51, 0]
  rgbAt(pixels, 12, 30).forEach((channel, index) => {
    expect(Math.abs(channel - burned[index])).toBeLessThan(2)
  })
  expect(rgbAt(pixels, 30, 30)).toEqual([153, 102, 51])
})
