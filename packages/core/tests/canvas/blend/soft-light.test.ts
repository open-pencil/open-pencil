import { afterAll, describe, expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { SceneGraph, type BlendMode, type Effect, type Fill } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { expectRgbaPixels } from '../helpers'

type RGB = [number, number, number]

interface Swatch {
  backdrop: RGB
  source: RGB
  figma: RGB
}

const CELL = 4
const SURFACE_WIDTH = CELL * 16
const SURFACE_HEIGHT = 32

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(
  ck,
  expectDefined(ck.MakeSurface(SURFACE_WIDTH, SURFACE_HEIGHT), 'surface')
)
afterAll(() => renderer.destroy())

function solid([r, g, b]: RGB, blendMode: BlendMode = 'NORMAL'): Fill {
  return {
    type: 'SOLID',
    color: { r: r / 255, g: g / 255, b: b / 255, a: 1 },
    opacity: 1,
    visible: true,
    blendMode
  }
}

type SourceLayer = (graph: SceneGraph, parentId: string, x: number, source: RGB) => void

const layerBlend: SourceLayer = (graph, parentId, x, source) => {
  graph.createNode('RECTANGLE', parentId, {
    x,
    width: CELL,
    height: CELL,
    fills: [solid(source)],
    blendMode: 'SOFT_LIGHT'
  })
}

const fillBlend: SourceLayer = (graph, parentId, x, source) => {
  graph.createNode('RECTANGLE', parentId, {
    x,
    width: CELL,
    height: CELL,
    fills: [solid(source, 'SOFT_LIGHT')]
  })
}

function groupBlend(opacity: number): SourceLayer {
  return (graph, parentId, x, source) => {
    const group = graph.createNode('FRAME', parentId, {
      x,
      width: CELL,
      height: CELL,
      fills: [],
      blendMode: 'SOFT_LIGHT',
      opacity
    })
    graph.createNode('RECTANGLE', group.id, { width: CELL, height: CELL, fills: [solid(source)] })
  }
}

function renderScene(build: (graph: SceneGraph, pageId: string) => void): Uint8Array {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  build(graph, page.id)
  renderer.pageId = page.id
  const canvas = renderer.surface.getCanvas()
  canvas.clear(ck.TRANSPARENT)
  renderer.renderSceneToCanvas(canvas, graph, page.id)
  renderer.surface.flush()
  const image = renderer.surface.makeImageSnapshot()
  try {
    return expectRgbaPixels(
      image.readPixels(0, 0, {
        width: SURFACE_WIDTH,
        height: SURFACE_HEIGHT,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      })
    )
  } finally {
    image.delete()
  }
}

function renderSwatches(swatches: Swatch[], sourceLayer: SourceLayer): RGB[] {
  const pixels = renderScene((graph, pageId) => {
    swatches.forEach(({ backdrop, source }, index) => {
      const x = index * CELL
      graph.createNode('RECTANGLE', pageId, {
        x,
        width: CELL,
        height: CELL,
        fills: [solid(backdrop)]
      })
      sourceLayer(graph, pageId, x, source)
    })
  })
  return swatches.map((_, index) => {
    const offset = ((CELL / 2) * SURFACE_WIDTH + index * CELL + CELL / 2) * 4
    return [pixels[offset], pixels[offset + 1], pixels[offset + 2]]
  })
}

function greys(cells: [number, number, number][]): Swatch[] {
  return cells.map(([backdrop, source, figma]) => ({
    backdrop: [backdrop, backdrop, backdrop],
    source: [source, source, source],
    figma: [figma, figma, figma]
  }))
}

function expectFigmaPixels(swatches: Swatch[], sourceLayer: SourceLayer) {
  const rendered = renderSwatches(swatches, sourceLayer)
  const misses = swatches
    .map((swatch, index) => ({ ...swatch, rendered: rendered[index] }))
    .filter(({ figma, rendered }) =>
      rendered.some((channel, c) => Math.abs(channel - figma[c]) > 1)
    )
  expect(misses).toEqual([])
}

// Live-measured in Figma: backdrop grey, source grey, result grey.
const OPAQUE = greys([
  [16, 0, 0],
  [16, 112, 12],
  [32, 96, 18],
  [48, 96, 32],
  [64, 0, 0],
  [128, 0, 75],
  [128, 64, 102],
  [192, 32, 170],
  [4, 255, 8],
  [64, 255, 112],
  [128, 255, 192],
  [192, 208, 222],
  [224, 160, 231],
  [12, 176, 16],
  [40, 240, 70],
  [8, 144, 9]
])

const GROUP_AT_A_FIFTH = greys([
  [16, 0, 9],
  [16, 112, 15],
  [32, 96, 29],
  [48, 96, 45],
  [64, 0, 51],
  [128, 0, 117],
  [128, 64, 123],
  [192, 32, 188],
  [4, 255, 5],
  [64, 255, 74],
  [128, 255, 141],
  [192, 208, 198],
  [224, 160, 225],
  [12, 176, 13],
  [40, 240, 46],
  [8, 144, 8]
])

const COLOURS: Swatch[] = [
  { backdrop: [20, 10, 5], source: [255, 0, 0], figma: [38, 0, 0] },
  { backdrop: [5, 20, 40], source: [0, 255, 0], figma: [0, 38, 0] },
  { backdrop: [40, 30, 10], source: [0, 0, 255], figma: [0, 0, 20] },
  { backdrop: [60, 20, 20], source: [255, 200, 100], figma: [106, 30, 11] },
  { backdrop: [10, 60, 30], source: [100, 200, 255], figma: [4, 86, 56] },
  { backdrop: [100, 80, 60], source: [180, 60, 200], figma: [125, 47, 86] },
  { backdrop: [30, 90, 160], source: [128, 128, 128], figma: [30, 90, 160] },
  { backdrop: [200, 150, 60], source: [230, 230, 230], figma: [235, 200, 97] }
]

describe('soft light, as Figma draws it', () => {
  test('darkens a dark backdrop under a dark source and lifts it less under a light one', () => {
    expectFigmaPixels(OPAQUE, layerBlend)
  })

  test('blends each colour channel on its own', () => {
    expectFigmaPixels(COLOURS, layerBlend)
  })

  test('a fill blends the same way as a layer', () => {
    expectFigmaPixels(OPAQUE, fillBlend)
  })

  test('a soft light group at a fifth opacity mixes its blend into the backdrop', () => {
    expectFigmaPixels(GROUP_AT_A_FIFTH, groupBlend(0.2))
  })

  test('a group blends its anti-aliased edge as a fill does, turned and off the pixel grid', () => {
    const turnedSource = (blend: 'group' | 'fill') => (graph: SceneGraph, pageId: string) => {
      graph.createNode('RECTANGLE', pageId, {
        width: SURFACE_WIDTH,
        height: SURFACE_HEIGHT,
        fills: [solid([128, 128, 128])]
      })
      const placement = { x: 20.5, y: 4.3, width: 20.6, height: 14.4, rotation: 17 }
      if (blend === 'fill') {
        graph.createNode('RECTANGLE', pageId, {
          ...placement,
          fills: [solid([0, 0, 0], 'SOFT_LIGHT')]
        })
        return
      }
      const group = graph.createNode('FRAME', pageId, {
        ...placement,
        fills: [],
        blendMode: 'SOFT_LIGHT'
      })
      graph.createNode('RECTANGLE', group.id, {
        width: placement.width,
        height: placement.height,
        fills: [solid([0, 0, 0])]
      })
    }
    const group = renderScene(turnedSource('group'))
    const fill = renderScene(turnedSource('fill'))
    const worst = group.reduce(
      (largest, channel, index) => Math.max(largest, Math.abs(channel - fill[index])),
      0
    )
    const darkestRed = group.reduce(
      (darkest, channel, index) => (index % 4 === 0 ? Math.min(darkest, channel) : darkest),
      255
    )
    expect(worst).toBeLessThanOrEqual(1)
    expect(darkestRed).toBeLessThan(80)
  })
})

function pixelAt(pixels: Uint8Array, x: number, y: number): number[] {
  const offset = (y * SURFACE_WIDTH + x) * 4
  return Array.from(pixels.subarray(offset, offset + 4))
}

interface TranslucentSwatch {
  backdrop: { grey: number; opacity: number } | null
  source: { grey: number; opacity: number }
  figma: [number, number]
}

// Live-measured in Figma: grey and alpha of a soft light layer over a translucent or empty backdrop.
const TRANSLUCENT: TranslucentSwatch[] = [
  { backdrop: null, source: { grey: 0, opacity: 1 }, figma: [0, 255] },
  { backdrop: null, source: { grey: 192, opacity: 0.5 }, figma: [191, 128] },
  { backdrop: { grey: 128, opacity: 0.5 }, source: { grey: 0, opacity: 1 }, figma: [37, 255] },
  { backdrop: { grey: 128, opacity: 0.5 }, source: { grey: 64, opacity: 0.5 }, figma: [97, 192] },
  { backdrop: { grey: 32, opacity: 0.5 }, source: { grey: 255, opacity: 0.5 }, figma: [114, 192] },
  { backdrop: { grey: 200, opacity: 0.25 }, source: { grey: 0, opacity: 0.5 }, figma: [75, 160] },
  { backdrop: { grey: 200, opacity: 0.25 }, source: { grey: 255, opacity: 1 }, figma: [252, 255] }
]

describe('soft light over a translucent backdrop, as Figma draws it', () => {
  test('keeps the source where nothing is under it and mixes by both alphas elsewhere', () => {
    const pixels = renderScene((graph, pageId) => {
      TRANSLUCENT.forEach(({ backdrop, source }, index) => {
        const x = index * CELL
        if (backdrop) {
          const fill = {
            ...solid([backdrop.grey, backdrop.grey, backdrop.grey]),
            opacity: backdrop.opacity
          }
          graph.createNode('RECTANGLE', pageId, { x, width: CELL, height: CELL, fills: [fill] })
        }
        graph.createNode('RECTANGLE', pageId, {
          x,
          width: CELL,
          height: CELL,
          fills: [solid([source.grey, source.grey, source.grey])],
          blendMode: 'SOFT_LIGHT',
          opacity: source.opacity
        })
      })
    })
    const misses = TRANSLUCENT.map((swatch, index) => {
      const [grey, , , alpha] = pixelAt(pixels, index * CELL + CELL / 2, CELL / 2)
      return { ...swatch, rendered: [grey, alpha] }
    }).filter(({ figma, rendered }) => rendered.some((value, i) => Math.abs(value - figma[i]) > 2))
    expect(misses).toEqual([])
  })
})

const BLACK_SOFT_LIGHT_SHADOW = {
  color: { r: 0, g: 0, b: 0, a: 1 },
  radius: 0,
  spread: 0,
  visible: true,
  blendMode: 'SOFT_LIGHT' as const
}

// Live-measured in Figma for a layer: black soft light over a 128 grey backdrop.
const BLACK_OVER_MID_GREY = 75

function shadowedOverlap(effect: Effect) {
  return (graph: SceneGraph, pageId: string) => {
    graph.createNode('RECTANGLE', pageId, {
      width: SURFACE_WIDTH,
      height: SURFACE_HEIGHT,
      fills: [solid([128, 128, 128])]
    })
    const frame = graph.createNode('FRAME', pageId, {
      x: 4,
      y: 4,
      width: 16,
      height: 8,
      fills: [],
      effects: [effect]
    })
    graph.createNode('RECTANGLE', frame.id, {
      width: 10,
      height: 8,
      fills: [solid([128, 128, 128])]
    })
    graph.createNode('RECTANGLE', frame.id, {
      x: 6,
      width: 10,
      height: 8,
      fills: [solid([128, 128, 128])],
      opacity: 0.5
    })
  }
}

describe('soft light shadows of overlapping layers, as Figma draws them', () => {
  for (const showShadowBehindNode of [false, true]) {
    test(`a drop shadow ${showShadowBehindNode ? 'shown' : 'cut out'} behind its layer`, () => {
      const pixels = renderScene(
        shadowedOverlap({
          ...BLACK_SOFT_LIGHT_SHADOW,
          type: 'DROP_SHADOW',
          offset: { x: 24, y: 0 },
          showShadowBehindNode
        })
      )
      expect(Math.abs(pixelAt(pixels, 36, 8)[0] - BLACK_OVER_MID_GREY)).toBeLessThanOrEqual(1)
      expect(pixelAt(pixels, 12, 8)[0]).toBe(128)
    })
  }

  test('an inner shadow', () => {
    const pixels = renderScene(
      shadowedOverlap({ ...BLACK_SOFT_LIGHT_SHADOW, type: 'INNER_SHADOW', offset: { x: 6, y: 0 } })
    )
    expect(Math.abs(pixelAt(pixels, 6, 8)[0] - BLACK_OVER_MID_GREY)).toBeLessThanOrEqual(1)
    expect(pixelAt(pixels, 16, 8)[0]).toBe(128)
  })
})
