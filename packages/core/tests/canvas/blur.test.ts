import { afterAll, describe, expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core'
import { initCanvasKit, renderNodesToImage } from '@open-pencil/core/io'
import { SceneGraph, type Effect, type SceneNode } from '@open-pencil/scene-graph'

import { expectDefined } from '../helpers/assert'

const ck = await initCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

/**
 * A row of pixels across the left edge of a 200px square at x = 100, from x = 60 to 140, in a
 * 400px frame, read from Figma 126 exports: alpha for layer blur and drop shadow, red for inner
 * shadow on white and for background blur over a black-to-white edge.
 */
const FIGMA: Record<string, number[]> = {
  'LAYER_BLUR 4': [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 3, 19, 51, 99, 157, 204, 237, 252, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255
  ],
  'LAYER_BLUR 16': [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 4, 6, 10, 15, 21,
    28, 36, 46, 55, 66, 77, 91, 105, 120, 135, 150, 164, 177, 188, 200, 210, 219, 227, 234, 240,
    245, 249, 252, 254, 254, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255
  ],
  'DROP_SHADOW 16': [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 4, 6, 10, 15, 21,
    28, 36, 46, 55, 66, 77, 91, 105, 120, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255
  ],
  'INNER_SHADOW 16': [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 135, 151, 164, 178, 190, 201, 211, 220, 227, 235, 239, 245, 249, 252,
    254, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255
  ],
  'BACKGROUND_BLUR 16': [
    3, 4, 4, 4, 3, 4, 3, 4, 4, 3, 3, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 3, 4, 3, 4, 7, 9, 12, 18, 23,
    31, 39, 48, 58, 69, 80, 94, 107, 122, 137, 152, 166, 179, 190, 202, 210, 219, 227, 234, 241,
    245, 249, 252, 254, 254, 255, 255, 254, 255, 255, 255, 254, 255, 254, 254, 254, 255, 255, 255,
    254, 255, 255, 255, 255, 255, 255, 255, 254, 254, 255
  ]
}

const solid = (r: number, g: number, b: number, opacity = 1) => ({
  type: 'SOLID' as const,
  color: { r, g, b, a: 1 },
  opacity,
  visible: true
})

function effect(type: Effect['type'], radius: number): Effect {
  return {
    type,
    radius,
    spread: 0,
    offset: { x: 0, y: 0 },
    color: { r: 0, g: 0, b: 0, a: 1 },
    visible: true,
    blendMode: 'NORMAL',
    showShadowBehindNode: false
  }
}

function edgeRow(build: (graph: SceneGraph, frameId: string) => void, channel: 0 | 3): number[] {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const frame = graph.createNode('FRAME', page, {
    width: 400,
    height: 400,
    fills: [],
    clipsContent: false
  })
  build(graph, frame.id)
  const png = expectDefined(
    renderNodesToImage(ck, renderer, graph, page, [frame.id], {
      scale: 1,
      format: 'PNG',
      trimTransparent: false
    })
  )
  const image = expectDefined(ck.MakeImageFromEncoded(png))
  try {
    const offset = (image.width() - 400) / 2
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
    for (let x = 60; x <= 140; x++) {
      row.push(pixels[((200 + offset) * image.width() + x + offset) * 4 + channel])
    }
    return row
  } finally {
    image.delete()
  }
}

function square(graph: SceneGraph, frameId: string, props: Partial<SceneNode>) {
  graph.createNode('RECTANGLE', frameId, { x: 100, y: 100, width: 200, height: 200, ...props })
}

function expectFigmaEdge(row: number[], figma: number[], from = 60) {
  const differences = row.flatMap((value, index) =>
    60 + index < from ? [] : [Math.abs(value - figma[index])]
  )
  const rms = Math.sqrt(differences.reduce((sum, d) => sum + d * d, 0) / differences.length)
  expect(Math.max(...differences)).toBeLessThanOrEqual(6)
  expect(rms).toBeLessThanOrEqual(2)
}

describe('blur effects fall off as in Figma', () => {
  for (const radius of [4, 16]) {
    test(`layer blur, radius ${radius}`, () => {
      const row = edgeRow(
        (graph, frameId) =>
          square(graph, frameId, {
            fills: [solid(1, 0, 0)],
            effects: [effect('LAYER_BLUR', radius)]
          }),
        3
      )
      expectFigmaEdge(row, FIGMA[`LAYER_BLUR ${radius}`])
    })
  }

  test('drop shadow', () => {
    const row = edgeRow(
      (graph, frameId) =>
        square(graph, frameId, { fills: [solid(1, 1, 1)], effects: [effect('DROP_SHADOW', 16)] }),
      3
    )
    expectFigmaEdge(row, FIGMA['DROP_SHADOW 16'])
  })

  test('inner shadow', () => {
    const row = edgeRow(
      (graph, frameId) =>
        square(graph, frameId, { fills: [solid(1, 1, 1)], effects: [effect('INNER_SHADOW', 16)] }),
      0
    )
    // Outside the square nothing is drawn, so the comparison starts at its edge.
    expectFigmaEdge(row, FIGMA['INNER_SHADOW 16'], 100)
  })

  test('background blur', () => {
    const row = edgeRow((graph, frameId) => {
      graph.createNode('RECTANGLE', frameId, { width: 100, height: 400, fills: [solid(0, 0, 0)] })
      graph.createNode('RECTANGLE', frameId, {
        x: 100,
        width: 300,
        height: 400,
        fills: [solid(1, 1, 1)]
      })
      graph.createNode('RECTANGLE', frameId, {
        width: 400,
        height: 400,
        fills: [solid(1, 1, 1, 0.01)],
        effects: [effect('BACKGROUND_BLUR', 16)]
      })
    }, 0)
    expectFigmaEdge(row, FIGMA['BACKGROUND_BLUR 16'])
  })
})
