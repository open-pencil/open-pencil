import { afterAll, describe, expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { renderNodesToImage } from '@open-pencil/core/io/formats/raster'
import {
  SceneGraph,
  type Effect,
  type GlassEffectParams,
  type SceneNode
} from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { type GlassGeometryMap, glassGeometryMap } from '#core/canvas/glass/map'
import type { GlassOutline } from '#core/canvas/glass/shader'

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

/**
 * Red read from Figma 126 exports at 1×, a 200px square of glass at (28, 28) in a 256px frame:
 * across row 128 from x = 24 to 100 over 16px black and white stripes (refraction 1, depth 40),
 * and down column 128 from y = 26 to 70 over flat gray (refraction 0, depth 30, light 100%).
 */
const FIGMA = {
  refraction: [
    255, 255, 255, 255, 91, 0, 6, 195, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254,
    254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 252,
    195, 51, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 55, 203, 252, 254, 254, 254, 254, 254, 254,
    254, 254, 254, 254, 254, 254, 253, 198, 56, 2, 0, 0, 0
  ],
  'light 0°': [
    128, 128, 218, 116, 117, 118, 118, 119, 120, 121, 121, 122, 122, 123, 124, 124, 125, 125, 125,
    125, 125, 125, 126, 126, 126, 126, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127,
    127, 127, 127, 127, 127, 127, 127
  ],
  'light 45°': [
    128, 128, 203, 120, 120, 121, 121, 122, 122, 123, 123, 124, 124, 125, 125, 125, 125, 125, 125,
    125, 126, 126, 126, 126, 126, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127,
    127, 127, 127, 127, 127, 127, 127
  ]
}

/**
 * How far Figma moves the backdrop under a 200px glass circle (refraction 1, depth 30), from its
 * left edge inward along row 128, in layer pixels, measured from coordinate-encoded exports.
 */
const FIGMA_CIRCLE_DISPLACEMENT = [
  20.5, 19.8, 18.6, 17.1, 15.3, 13.3, 11.3, 9.1, 7.4, 5.9, 4.4, 3.3, 2.4, 1.6, 1.0
]

function glass(params: Partial<GlassEffectParams>): Effect {
  return {
    type: 'GLASS',
    radius: 0,
    spread: 0,
    offset: { x: 0, y: 0 },
    color: { r: 0, g: 0, b: 0, a: 1 },
    visible: true,
    blendMode: 'NORMAL',
    showShadowBehindNode: false,
    glass: {
      refraction: 1,
      depth: 40,
      lightAngle: 0,
      lightIntensity: 0,
      dispersion: 0,
      ...params
    }
  }
}

const solid = (r: number, g = r, b = r) => ({
  type: 'SOLID' as const,
  color: { r, g, b, a: 1 },
  opacity: 1,
  visible: true
})

/** Red of every pixel of a 256px frame holding `backdrop` and then the glass layer. */
function render(
  backdrop: (graph: SceneGraph, frameId: string) => void,
  layer: Partial<SceneNode> & { type?: 'RECTANGLE' | 'ELLIPSE' }
): (x: number, y: number) => number {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const frame = graph.createNode('FRAME', page, { width: 256, height: 256, fills: [] })
  backdrop(graph, frame.id)
  const { type = 'RECTANGLE', ...props } = layer
  graph.createNode(type, frame.id, { x: 28, y: 28, width: 200, height: 200, fills: [], ...props })
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
        width: 256,
        height: 256,
        alphaType: ck.AlphaType.Unpremul,
        colorType: ck.ColorType.RGBA_8888,
        colorSpace: ck.ColorSpace.SRGB
      })
    )
    return (x, y) => pixels[(y * 256 + x) * 4]
  } finally {
    image.delete()
  }
}

function stripes(graph: SceneGraph, frameId: string) {
  for (let x = 0; x < 256; x += 16) {
    graph.createNode('RECTANGLE', frameId, {
      x,
      width: 16,
      height: 256,
      fills: [solid(x % 32 ? 1 : 0)]
    })
  }
}

function gray(graph: SceneGraph, frameId: string) {
  graph.createNode('RECTANGLE', frameId, { width: 256, height: 256, fills: [solid(128 / 255)] })
}

/** Columns whose red is their own x, so a pixel's red says where its backdrop came from. */
function columns(graph: SceneGraph, frameId: string) {
  for (let x = 0; x < 256; x++) {
    graph.createNode('RECTANGLE', frameId, {
      x,
      width: 1,
      height: 256,
      fills: [solid(x / 255, 0, 0)]
    })
  }
}

function expectFigma(ours: number[], figma: number[], maxDifference: number, maxRms: number) {
  const differences = ours.map((value, index) => Math.abs(value - figma[index]))
  const rms = Math.sqrt(differences.reduce((sum, d) => sum + d * d, 0) / differences.length)
  expect(Math.max(...differences)).toBeLessThanOrEqual(maxDifference)
  expect(rms).toBeLessThanOrEqual(maxRms)
}

describe('glass draws as Figma does', () => {
  test('refraction folds the backdrop inward within depth of a box edge', () => {
    const red = render(stripes, { effects: [glass({})] })
    const row = FIGMA.refraction.map((_, index) => red(24 + index, 128))
    expectFigma(row, FIGMA.refraction, 6, 2)
  })

  test('light adds a rim and a band that turn with the light angle', () => {
    for (const [name, lightAngle] of [
      ['light 0°', 0],
      ['light 45°', 45]
    ] as const) {
      const red = render(gray, {
        effects: [glass({ refraction: 0, depth: 30, lightIntensity: 1, lightAngle })]
      })
      const column = FIGMA[name].map((_, index) => red(128, 26 + index))
      expectFigma(column, FIGMA[name], 5, 2)
    }
  })

  test('an ellipse refracts along its own outline', () => {
    const red = render(columns, { type: 'ELLIPSE', effects: [glass({ depth: 30 })] })
    const moved = FIGMA_CIRCLE_DISPLACEMENT.map((_, index) => red(29 + index, 128) - (29 + index))
    for (const [index, figma] of FIGMA_CIRCLE_DISPLACEMENT.entries()) {
      expect(Math.abs(moved[index] - figma)).toBeLessThanOrEqual(1.5)
    }
  })
})

describe('glass geometry map', () => {
  // A diamond inside a 100px layer: corners at the middle of each side.
  const diamond: GlassOutline = {
    origin: [0, 0],
    size: [100, 100],
    radii: [0, 0, 0, 0],
    isBox: false,
    segments: new Float32Array([50, 0, 100, 50, 100, 50, 50, 100, 50, 100, 0, 50, 0, 50, 50, 0])
  }
  const layer = { id: 'map-diamond', width: 100, height: 100 } as SceneNode

  function at(map: GlassGeometryMap, x: number, y: number): number[] {
    const [cx, cy] = [(x - map.origin[0]) * map.scale, (y - map.origin[1]) * map.scale]
    const pixel = map.image.readPixels(Math.floor(cx), Math.floor(cy), {
      width: 1,
      height: 1,
      colorType: ck.ColorType.RGBA_F32,
      alphaType: ck.AlphaType.Premul,
      colorSpace: ck.ColorSpace.SRGB
    })
    return Array.from(expectDefined(pixel, 'map pixel')).slice(0, 3)
  }

  test('holds the signed distance to the outline and the direction into it', () => {
    const surface = expectDefined(ck.MakeSurface(8, 8), 'surface')
    const map = expectDefined(
      glassGeometryMap(renderer, surface.getCanvas(), layer, diamond, 60),
      'map'
    )
    expect(map.scale).toBe(1)
    const inward = [-Math.SQRT1_2, Math.SQRT1_2]
    // Inside, 10 / √2 from the upper right edge.
    const [inside, ix, iy] = at(map, 60.5, 20.5)
    expect(inside).toBeCloseTo(10 / Math.SQRT2, 1)
    expect([ix, iy].map((v) => Math.round(v * 100) / 100)).toEqual(
      inward.map((v) => Math.round(v * 100) / 100)
    )
    // Outside, 30 / √2 past the same edge: negative, still pointing in.
    const [outside, ox, oy] = at(map, 90.5, 10.5)
    expect(outside).toBeCloseTo(-30 / Math.SQRT2, 1)
    expect([ox, oy].map((v) => Math.round(v * 100) / 100)).toEqual(
      inward.map((v) => Math.round(v * 100) / 100)
    )
    // The same outline at the same zoom step reads the map already drawn.
    expect(glassGeometryMap(renderer, surface.getCanvas(), layer, diamond, 60)).toBe(map)
    surface.delete()
  })

  test('gives way to walking the outline where no half-float surface can be made', () => {
    const effect = glass({ depth: 30, lightIntensity: 1 })
    const pixels = (read: (x: number, y: number) => number) =>
      Array.from({ length: 256 * 256 }, (_, i) => read(i % 256, Math.floor(i / 256)))
    const mapped = pixels(render(columns, { type: 'ELLIPSE', effects: [effect] }))
    const make = renderer.surface.makeSurface.bind(renderer.surface)
    renderer.surface.makeSurface = (info) =>
      info.colorType === ck.ColorType.RGBA_F16 ? null : make(info)
    try {
      const walked = pixels(render(columns, { type: 'ELLIPSE', effects: [effect] }))
      // Refraction still moves the backdrop: a pixel's red is no longer its own x.
      expect(walked.some((red, i) => i % 256 > 40 && i % 256 < 216 && red !== i % 256)).toBe(true)
      const mean =
        walked.reduce((sum, red, i) => sum + Math.abs(red - mapped[i]), 0) / walked.length
      expect(mean).toBeLessThan(0.5)
    } finally {
      renderer.surface.makeSurface = make
    }
  })

  test('is not drawn for a box, which the shaders compute exactly', () => {
    const surface = expectDefined(ck.MakeSurface(8, 8), 'surface')
    expect(
      glassGeometryMap(renderer, surface.getCanvas(), layer, { ...diamond, isBox: true }, 60)
    ).toBeNull()
    surface.delete()
  })
})
