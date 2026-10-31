import { afterAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import { SceneGraph, type BlendMode, type Fill } from '@open-pencil/scene-graph'

const SIZE = 40

const ck = await initCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(SIZE, SIZE), 'surface'))
afterAll(() => renderer.destroy())

const BACKDROP = { r: 0.6, g: 0.4, b: 0.2 }
const SOURCE = { r: 0.2, g: 0.8, b: 0.7 }

function solid(color: { r: number; g: number; b: number }, blendMode: BlendMode = 'NORMAL'): Fill {
  return { type: 'SOLID', color: { ...color, a: 1 }, opacity: 1, visible: true, blendMode }
}

type Scene = (graph: SceneGraph, pageId: string) => void

function backdrop(graph: SceneGraph, pageId: string) {
  graph.createNode('RECTANGLE', pageId, { width: SIZE, height: SIZE, fills: [solid(BACKDROP)] })
}

function renderCenter(build: Scene, under: Scene = backdrop): number[] {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  under(graph, page.id)
  build(graph, page.id)
  renderer.pageId = page.id
  const canvas = renderer.surface.getCanvas()
  canvas.clear(ck.TRANSPARENT)
  renderer.renderSceneToCanvas(canvas, graph, page.id)
  renderer.surface.flush()
  const image = renderer.surface.makeImageSnapshot()
  try {
    const pixels = expectDefined(
      image.readPixels(SIZE / 2, SIZE / 2, {
        width: 1,
        height: 1,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      }),
      'pixels'
    )
    return Array.from(pixels.subarray(0, 4))
  } finally {
    image.delete()
  }
}

function overlay(fills: Fill[], blendMode: BlendMode = 'PASS_THROUGH') {
  return (graph: SceneGraph, pageId: string) => {
    graph.createNode('RECTANGLE', pageId, { width: SIZE, height: SIZE, fills, blendMode })
  }
}

function expectChannelsNear(actual: number[], expected: number[]) {
  expected.forEach((channel, index) => expect(Math.abs(actual[index] - channel)).toBeLessThan(2))
}

// Live-measured in Figma: SOURCE over BACKDROP, opaque and at half opacity.
const LINEAR_DODGE = [204, 255, 229]
const LINEAR_BURN = [0, 51, 0]

describe('linear blend modes, as Figma draws them', () => {
  test('plus lighter adds a fill to what is under it', () => {
    expectChannelsNear(renderCenter(overlay([solid(SOURCE, 'LINEAR_DODGE')])), LINEAR_DODGE)
  })

  test('plus darker adds a fill to what is under it, less white, and only that fill', () => {
    expectChannelsNear(renderCenter(overlay([solid(SOURCE, 'LINEAR_BURN')])), LINEAR_BURN)
    const burnedThenCovered = renderCenter(overlay([solid(SOURCE, 'LINEAR_BURN'), solid(SOURCE)]))
    expectChannelsNear(burnedThenCovered, [51, 204, 179])
  })

  test('plus darker over nothing draws the fill as normal', () => {
    const nothing: Scene = () => undefined
    expectChannelsNear(
      renderCenter(overlay([solid(SOURCE, 'LINEAR_BURN')]), nothing),
      [51, 204, 179, 255]
    )
  })

  test('a half transparent plus lighter fill mixes its sum with what is under it', () => {
    const halfDodge = { ...solid(SOURCE, 'LINEAR_DODGE'), opacity: 0.5 }
    expectChannelsNear(renderCenter(overlay([halfDodge])), [179, 204, 140, 255])
  })

  test('a half transparent plus darker fill takes the overlap off the sum, not off the blend', () => {
    const halfBurn = { ...solid(SOURCE, 'LINEAR_BURN'), opacity: 0.5 }
    expectChannelsNear(renderCenter(overlay([halfBurn])), [51, 76, 12, 255])
  })

  // Live-measured in Figma: a 60% grey backdrop at 50% opacity under (0.7, 0.2, 0.5).
  test('blends over a half transparent backdrop as Figma does', () => {
    const halfGrey: Scene = (graph, pageId) => {
      const grey = { ...solid({ r: 0.6, g: 0.6, b: 0.6 }), opacity: 0.5 }
      graph.createNode('RECTANGLE', pageId, { width: SIZE, height: SIZE, fills: [grey] })
    }
    const paint = { r: 0.7, g: 0.2, b: 0.5 }
    expectChannelsNear(
      renderCenter(overlay([solid(paint, 'LINEAR_BURN')]), halfGrey),
      [127, 0, 77, 255]
    )
    const halfDodge = { ...solid(paint, 'LINEAR_DODGE'), opacity: 0.5 }
    expectChannelsNear(renderCenter(overlay([halfDodge]), halfGrey), [220, 137, 187, 192])
    const halfBurn = { ...solid(paint, 'LINEAR_BURN'), opacity: 0.5 }
    expectChannelsNear(renderCenter(overlay([halfBurn]), halfGrey), [136, 51, 103, 191])
  })

  test('a half transparent fill over nothing stays half transparent', () => {
    const nothing: Scene = () => undefined
    for (const blendMode of ['LINEAR_DODGE', 'LINEAR_BURN'] as const) {
      const half = { ...solid(SOURCE, blendMode), opacity: 0.5 }
      expectChannelsNear(renderCenter(overlay([half]), nothing), [51, 204, 179, 128])
    }
  })

  test('a half transparent fill over a half transparent backdrop covers three quarters', () => {
    const halfBackdrop: Scene = (graph, pageId) => {
      graph.createNode('RECTANGLE', pageId, {
        width: SIZE,
        height: SIZE,
        fills: [{ ...solid(BACKDROP), opacity: 0.5 }]
      })
    }
    for (const blendMode of ['LINEAR_DODGE', 'LINEAR_BURN'] as const) {
      const half = { ...solid(SOURCE, blendMode), opacity: 0.5 }
      expect(Math.abs(renderCenter(overlay([half]), halfBackdrop)[3] - 191)).toBeLessThan(2)
    }
  })

  test('a drop shadow blends the same way as a fill', () => {
    const castsOntoCenter: Scene = (graph, pageId) => {
      graph.createNode('RECTANGLE', pageId, {
        width: 10,
        height: 10,
        fills: [solid(BACKDROP)],
        effects: [
          {
            type: 'DROP_SHADOW',
            color: { ...SOURCE, a: 1 },
            offset: { x: 15, y: 15 },
            radius: 0,
            spread: 0,
            visible: true,
            blendMode: 'LINEAR_BURN',
            showShadowBehindNode: false
          }
        ]
      })
    }
    expectChannelsNear(renderCenter(castsOntoCenter), LINEAR_BURN)
  })

  test('a layer blends the same way as a fill', () => {
    expectChannelsNear(renderCenter(overlay([solid(SOURCE)], 'LINEAR_BURN')), LINEAR_BURN)
    expectChannelsNear(renderCenter(overlay([solid(SOURCE)], 'LINEAR_DODGE')), LINEAR_DODGE)
  })
})
