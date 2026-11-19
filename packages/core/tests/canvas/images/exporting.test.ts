import { afterAll, describe, expect, test } from 'bun:test'

import {
  ALL_SEVEN,
  callsDuring,
  distinctPixels,
  encode,
  imageFill,
  isOpaque,
  largestDifference,
  readEncoded,
  readImage,
  shaderPixels,
  withDecoded
} from '#core-tests/helpers/adjusted-images'

import { SceneGraph, type ImageFilters } from '@open-pencil/scene-graph'
import { computeImageHash } from '@open-pencil/scene-graph/images'
import { expectDefined } from '@open-pencil/test-support/assert'

import * as baked from '#core/canvas/images/baked'
import { shaderIsCheaper } from '#core/canvas/images/exporting'
import { SkiaRenderer } from '#core/canvas/renderer/skia'
import { getCanvasKit } from '#core/canvaskit'
import {
  drawRegionToImage,
  renderNodesToImage,
  renderThumbnail
} from '#core/io/formats/raster/render'

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

const NOISE_EDGE = 256
const NOISE_PNG = encode(distinctPixels(NOISE_EDGE * NOISE_EDGE), NOISE_EDGE, NOISE_EDGE)
const SMALL_EDGE = 8
const SMALL_PNG = encode(distinctPixels(SMALL_EDGE * SMALL_EDGE), SMALL_EDGE, SMALL_EDGE)
const WIDE_EDGE = 64
const WIDE_GAMUT_PNG = encode(
  distinctPixels(WIDE_EDGE * WIDE_EDGE),
  WIDE_EDGE,
  WIDE_EDGE,
  ck.ColorSpace.DISPLAY_P3
)
const WIDE_GAMUT_SETS: ImageFilters[] = [
  ALL_SEVEN,
  { exposure: -0.5 },
  { saturation: -1 },
  { saturation: 1 },
  { contrast: 1 },
  { tint: -1 }
]

function layersOf(png: Uint8Array, sizes: number[]) {
  const graph = new SceneGraph()
  const hash = computeImageHash(png)
  graph.images.set(hash, png)
  const pageId = graph.getPages()[0].id
  const nodeIds = sizes.map(
    (size, index) =>
      graph.createNode('RECTANGLE', pageId, {
        x: index * (size + 10),
        width: size,
        height: size,
        fills: [imageFill(hash, ALL_SEVEN)]
      }).id
  )
  return { graph, pageId, nodeIds }
}

function bakesAndScans(job: () => void): { bakes: number; scans: number } {
  let scans = 0
  const bakes = callsDuring(baked, 'bakeFromPalette', () => {
    scans = callsDuring(baked, 'withSourcePixels', job)
  })
  return { bakes, scans }
}

function exported(png: Uint8Array, sizes: number[], scale: number): Uint8Array {
  const { graph, pageId, nodeIds } = layersOf(png, sizes)
  return expectDefined(
    renderNodesToImage(ck, renderer, graph, pageId, nodeIds, { scale, format: 'PNG' }),
    'export'
  )
}

describe('choosing between a baked image and the adjustment shader', () => {
  test('draws a large many-colour image shown small through the shader, counting once', () => {
    const counted = bakesAndScans(() => {
      exported(NOISE_PNG, [16, 16], 1)
    })
    expect(counted).toEqual({ bakes: 0, scans: 1 })
  })

  test('bakes a small image drawn larger than it is', () => {
    const counted = bakesAndScans(() => {
      exported(SMALL_PNG, [96, 96], 1)
    })
    expect(counted).toEqual({ bakes: 1, scans: 1 })
  })

  test('weighs a thumbnail by the pixels it covers', () => {
    const noise = layersOf(NOISE_PNG, [512])
    const small = layersOf(SMALL_PNG, [512])
    const noiseThumbnail = bakesAndScans(() => {
      expectDefined(renderThumbnail(ck, renderer, noise.graph, noise.pageId, 32, 32), 'thumbnail')
    })
    const smallThumbnail = bakesAndScans(() => {
      expectDefined(renderThumbnail(ck, renderer, small.graph, small.pageId, 32, 32), 'thumbnail')
    })
    expect(noiseThumbnail.bakes).toBe(0)
    expect(smallThumbnail.bakes).toBe(1)
  })

  test('weighs a region render by the pixels it covers', () => {
    const { graph, pageId } = layersOf(NOISE_PNG, [512])
    const region = { minX: 0, minY: 0, maxX: 512, maxY: 512 }
    const small = bakesAndScans(() => {
      expectDefined(drawRegionToImage(ck, renderer, graph, pageId, region, 0.05), 'region')
    })
    const large = bakesAndScans(() => {
      expectDefined(drawRegionToImage(ck, renderer, graph, pageId, region, 1), 'region')
    })
    expect(small.bakes).toBe(0)
    expect(large.bakes).toBe(1)
  })

  test('weighs only the part of a layer the export shows', () => {
    const { graph, pageId } = layersOf(NOISE_PNG, [4096])
    const corner = { minX: 0, minY: 0, maxX: 64, maxY: 64 }
    const counted = bakesAndScans(() => {
      expectDefined(drawRegionToImage(ck, renderer, graph, pageId, corner, 1), 'region')
    })
    expect(counted.bakes).toBe(0)
  })
})

describe('the cost of baking', () => {
  const source = { width: 100, height: 100, bakesExactly: true, distinctColors: null }

  test('loses for an image it cannot read exactly in eight bits', () => {
    expect(shaderIsCheaper({ ...source, bakesExactly: false }, Number.POSITIVE_INFINITY)).toBe(true)
  })

  test('wins without counting when the draw covers as many pixels as the image holds', () => {
    expect(shaderIsCheaper({ ...source, distinctColors: 10_000 }, 10_000)).toBe(false)
  })

  test('needs the colours counted when the image holds more pixels than the draw covers', () => {
    expect(shaderIsCheaper(source, 1000)).toBe(false)
    expect(shaderIsCheaper({ ...source, distinctColors: 5000 }, 1000)).toBe(true)
    expect(shaderIsCheaper({ ...source, distinctColors: 50 }, 1000)).toBe(false)
  })
})

describe('a Display P3 image', () => {
  test('decodes in a colour space other than sRGB', () => {
    withDecoded(WIDE_GAMUT_PNG, (image) => {
      const colorSpace = image.getColorSpace()
      try {
        expect(ck.ColorSpace.Equals(colorSpace, ck.ColorSpace.SRGB)).toBe(false)
      } finally {
        colorSpace.delete()
      }
    })
  })

  test.each(WIDE_GAMUT_SETS)('bakes exactly as the shader adjusts it: %o', (filters) => {
    withDecoded(WIDE_GAMUT_PNG, (image) => {
      const bake = expectDefined(baked.bakeAdjustedImage(renderer, image, filters), 'baked image')
      try {
        const shaded = shaderPixels(renderer, image, filters, 'unpremultiplied')
        expect(largestDifference(readImage(bake, 'unpremultiplied'), shaded, isOpaque)).toBe(0)
      } finally {
        bake.delete()
      }
    })
  })

  test('exports at 1:1 as the shader adjusts it', () => {
    const png = exported(WIDE_GAMUT_PNG, [WIDE_EDGE], 1)
    withDecoded(WIDE_GAMUT_PNG, (image) => {
      const shaded = shaderPixels(renderer, image, ALL_SEVEN, 'unpremultiplied')
      expect(largestDifference(readEncoded(png, 'unpremultiplied'), shaded, isOpaque)).toBe(0)
    })
  })
})
