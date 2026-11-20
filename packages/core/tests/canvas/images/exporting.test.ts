import { afterAll, describe, expect, test } from 'bun:test'

import {
  ALL_SEVEN,
  bakedImage,
  decodesDuring,
  distinctPixels,
  encode,
  exportWork,
  imageFill,
  isOpaque,
  largestDifference,
  readEncoded,
  readImage,
  shaderPixels,
  withDecoded
} from '#core-tests/helpers/adjusted-images'

import { SceneGraph, type ImageFilters, type SceneNode } from '@open-pencil/scene-graph'
import { computeImageHash } from '@open-pencil/scene-graph/images'
import { expectDefined } from '@open-pencil/test-support/assert'

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
const NOISE_HASH = computeImageHash(NOISE_PNG)
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

function graphWith(png: Uint8Array) {
  const graph = new SceneGraph()
  graph.images.set(computeImageHash(png), png)
  return { graph, pageId: graph.getPages()[0].id }
}

function layersOf(png: Uint8Array, sizes: number[]) {
  const { graph, pageId } = graphWith(png)
  const hash = computeImageHash(png)
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

function exportedNodes(
  r: SkiaRenderer,
  graph: SceneGraph,
  pageId: string,
  nodeIds: string[],
  scale = 1
) {
  return expectDefined(
    renderNodesToImage(ck, r, graph, pageId, nodeIds, { scale, format: 'PNG' }),
    'export'
  )
}

function exported(png: Uint8Array, sizes: number[], scale: number): Uint8Array {
  const { graph, pageId, nodeIds } = layersOf(png, sizes)
  return exportedNodes(renderer, graph, pageId, nodeIds, scale)
}

function exportedLayer(layer: Partial<SceneNode>) {
  const { graph, pageId } = graphWith(NOISE_PNG)
  const node = graph.createNode('RECTANGLE', pageId, layer)
  return exportWork(renderer, () => {
    exportedNodes(renderer, graph, pageId, [node.id])
  })
}

function patternOfNoise(scale: number) {
  const { graph, pageId } = graphWith(NOISE_PNG)
  const source = graph.createNode('RECTANGLE', pageId, {
    x: 5000,
    width: NOISE_EDGE,
    height: NOISE_EDGE,
    fills: [imageFill(NOISE_HASH, ALL_SEVEN)]
  })
  graph.createNode('RECTANGLE', pageId, {
    width: NOISE_EDGE,
    height: NOISE_EDGE,
    fills: [
      {
        type: 'PATTERN',
        sourceNodeId: source.id,
        scale,
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 1,
        visible: true
      }
    ]
  })
  return { graph, pageId }
}

describe('choosing between a baked image and the adjustment shader', () => {
  test('draws a large many-colour image shown small through the shader', () => {
    const work = exportWork(renderer, () => {
      exported(NOISE_PNG, [16, 16], 1)
    })
    expect(work).toEqual({ bakes: 0, counted: 1 })
  })

  test('skips counting colours when even the least bake costs more than the shader', () => {
    const work = exportWork(renderer, () => {
      exported(NOISE_PNG, [2], 1)
    })
    expect(work).toEqual({ bakes: 0, counted: 0 })
  })

  test('bakes a small image drawn larger than it is', () => {
    const work = exportWork(renderer, () => {
      exported(SMALL_PNG, [96, 96], 1)
    })
    expect(work).toEqual({ bakes: 1, counted: 1 })
  })

  test('weighs a thumbnail by the pixels it covers', () => {
    const noise = layersOf(NOISE_PNG, [512])
    const small = layersOf(SMALL_PNG, [512])
    const noiseThumbnail = exportWork(renderer, () => {
      expectDefined(renderThumbnail(ck, renderer, noise.graph, noise.pageId, 32, 32), 'thumbnail')
    })
    const smallThumbnail = exportWork(renderer, () => {
      expectDefined(renderThumbnail(ck, renderer, small.graph, small.pageId, 32, 32), 'thumbnail')
    })
    expect(noiseThumbnail.bakes).toBe(0)
    expect(smallThumbnail.bakes).toBe(1)
  })

  test('weighs a region render by the pixels it covers', () => {
    const { graph, pageId } = layersOf(NOISE_PNG, [512])
    const region = { minX: 0, minY: 0, maxX: 512, maxY: 512 }
    const small = exportWork(renderer, () => {
      expectDefined(drawRegionToImage(ck, renderer, graph, pageId, region, 0.05), 'region')
    })
    const large = exportWork(renderer, () => {
      expectDefined(drawRegionToImage(ck, renderer, graph, pageId, region, 1), 'region')
    })
    expect(small.bakes).toBe(0)
    expect(large.bakes).toBe(1)
  })

  test('weighs only the part of a layer the export shows', () => {
    const { graph, pageId } = layersOf(NOISE_PNG, [4096])
    const corner = { minX: 0, minY: 0, maxX: 64, maxY: 64 }
    const work = exportWork(renderer, () => {
      expectDefined(drawRegionToImage(ck, renderer, graph, pageId, corner, 1), 'region')
    })
    expect(work.bakes).toBe(0)
  })

  test('neither counts nor bakes a layer outside the region', () => {
    const { graph, pageId } = layersOf(NOISE_PNG, [512])
    const elsewhere = { minX: 1000, minY: 1000, maxX: 1064, maxY: 1064 }
    const work = exportWork(renderer, () => {
      expectDefined(drawRegionToImage(ck, renderer, graph, pageId, elsewhere, 1), 'region')
    })
    expect(work).toEqual({ bakes: 0, counted: 0 })
  })

  test('weighs an image stroke by its band, not the whole layer', () => {
    const stroke = { ...imageFill(NOISE_HASH, ALL_SEVEN), weight: 1, align: 'INSIDE' as const }
    const work = exportedLayer({ width: NOISE_EDGE, height: NOISE_EDGE, strokes: [stroke] })
    expect(work.bakes).toBe(0)
  })

  test('weighs a rotated strip by its own area, not its bounding box', () => {
    const work = exportedLayer({
      width: 1000,
      height: 4,
      rotation: 45,
      fills: [imageFill(NOISE_HASH, ALL_SEVEN)]
    })
    expect(work.bakes).toBe(0)
  })

  test('weighs an image in a pattern source at the scale the pattern draws it', () => {
    const { graph, pageId } = patternOfNoise(0.04)
    const region = { minX: 0, minY: 0, maxX: NOISE_EDGE, maxY: NOISE_EDGE }
    const work = exportWork(renderer, () => {
      expectDefined(drawRegionToImage(ck, renderer, graph, pageId, region, 1), 'region')
    })
    expect(work.bakes).toBe(0)
  })

  test('decodes an image once when the shader draws it', () => {
    const own = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
    try {
      const { graph, pageId, nodeIds } = layersOf(NOISE_PNG, [16])
      const decodes = decodesDuring(() => {
        exportedNodes(own, graph, pageId, nodeIds)
      })
      expect(decodes).toBe(1)
    } finally {
      own.destroy()
    }
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
      const bake = bakedImage(renderer, image, filters)
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
