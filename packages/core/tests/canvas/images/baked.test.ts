import { afterAll, describe, expect, test } from 'bun:test'

import {
  ALL_SEVEN,
  OPAQUE,
  callsDuring,
  distinctPixels,
  encode,
  imageFill,
  isOpaque,
  isTranslucent,
  isTransparent,
  largestDifference,
  pixelInfo,
  readEncoded,
  readImage,
  shaderPixels,
  withDecoded,
  type AlphaType
} from '#core-tests/helpers/adjusted-images'

import type { Image } from '@open-pencil/canvaskit'
import { SceneGraph, type ImageFilters } from '@open-pencil/scene-graph'
import { computeImageHash } from '@open-pencil/scene-graph/images'
import { expectDefined } from '@open-pencil/test-support/assert'

import * as adjustments from '#core/canvas/images/adjustments'
import { PALETTE_ROW, bakeAdjustedImage } from '#core/canvas/images/baked'
import { createImageCache } from '#core/canvas/images/cache'
import { adjustedImageForExport, drawingExport } from '#core/canvas/images/exporting'
import { SkiaRenderer } from '#core/canvas/renderer/skia'
import { getCanvasKit } from '#core/canvaskit'
import { renderPagesToPDF } from '#core/io/formats/pdf/export'
import { renderNodesToImage } from '#core/io/formats/raster/render'

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

const WIDTH = 96
const HEIGHT = 64
const TRANSLUCENT_ALPHAS = [1, 64, 128, 200]
const SLIDERS = [
  'exposure',
  'contrast',
  'saturation',
  'temperature',
  'tint',
  'highlights',
  'shadows'
] as const
const FILTER_SETS: ImageFilters[] = [
  ...SLIDERS.flatMap((slider) => [{ [slider]: -1 }, { [slider]: 1 }]),
  ALL_SEVEN
]

function alphaAt(index: number): number {
  const row = Math.floor(index / WIDTH)
  if (row === 0) {
    return 0
  }
  if (row === 1) {
    return TRANSLUCENT_ALPHAS[index % TRANSLUCENT_ALPHAS.length]
  }
  return OPAQUE
}

function randomPixels(): Uint8Array {
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4)
  let seed = 0x2545f491
  for (let index = 0; index < WIDTH * HEIGHT; index++) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0
    pixels.set([seed & 0xff, (seed >>> 8) & 0xff, (seed >>> 16) & 0xff, alphaAt(index)], index * 4)
  }
  return pixels
}

const PNG = encode(randomPixels(), WIDTH, HEIGHT)
const HASH = computeImageHash(PNG)

const DROP_SHADOW = {
  type: 'DROP_SHADOW' as const,
  color: { r: 0, g: 0, b: 0, a: 0.5 },
  offset: { x: 2, y: 2 },
  radius: 4,
  spread: 0,
  visible: true,
  blendMode: 'NORMAL' as const
}

function graphWithLayers(layers: { page: number; filters: ImageFilters; shadow?: boolean }[]) {
  const graph = new SceneGraph()
  graph.images.set(HASH, PNG)
  const pages = [graph.getPages()[0].id]
  const specs = layers.map(({ page, filters, shadow }, index) => {
    while (pages.length <= page) {
      pages.push(graph.addPage(`Page ${pages.length + 1}`).id)
    }
    const layer = graph.createNode('RECTANGLE', pages[page], {
      x: index * (WIDTH + 10),
      width: WIDTH,
      height: HEIGHT,
      fills: [imageFill(HASH, filters)],
      effects: shadow ? [DROP_SHADOW] : []
    })
    return { pageId: pages[page], nodeIds: [layer.id] }
  })
  return { graph, specs }
}

function exportedPixels(filters: ImageFilters, alpha: AlphaType): Uint8Array {
  const { graph, specs } = graphWithLayers([{ page: 0, filters }])
  const [{ pageId, nodeIds }] = specs
  const png = expectDefined(
    renderNodesToImage(ck, renderer, graph, pageId, nodeIds, { scale: 1, format: 'PNG' }),
    'export'
  )
  return readEncoded(png, alpha)
}

function bakedPixels(
  r: SkiaRenderer,
  image: Image,
  filters: ImageFilters,
  alpha: AlphaType
): Uint8Array {
  const baked = expectDefined(bakeAdjustedImage(r, image, filters), 'baked image')
  try {
    return readImage(baked, alpha)
  } finally {
    baked.delete()
  }
}

function expectShaderMatch(
  pixels: (filters: ImageFilters, alpha: AlphaType) => Uint8Array,
  image: Image,
  filters: ImageFilters
): void {
  const unpremultiplied = pixels(filters, 'unpremultiplied')
  const shadedUnpremultiplied = shaderPixels(renderer, image, filters, 'unpremultiplied')
  const premultiplied = pixels(filters, 'premultiplied')
  const shadedPremultiplied = shaderPixels(renderer, image, filters, 'premultiplied')
  expect(largestDifference(unpremultiplied, shadedUnpremultiplied, isOpaque)).toBe(0)
  expect(largestDifference(premultiplied, shadedPremultiplied, isTranslucent)).toBeLessThanOrEqual(
    1
  )
  expect(largestDifference(premultiplied, shadedPremultiplied, isTransparent)).toBe(0)
}

function adjustmentShadersMade(job: () => void): number {
  return callsDuring(adjustments, 'makeAdjustedImageShader', job)
}

function expectBakeMatchesShader(r: SkiaRenderer, image: Image, filters: ImageFilters): void {
  const baked = bakedPixels(r, image, filters, 'unpremultiplied')
  const shaded = shaderPixels(renderer, image, filters, 'unpremultiplied')
  expect(largestDifference(baked, shaded, isOpaque)).toBe(0)
}

describe('baking adjustments into an image', () => {
  test.each(FILTER_SETS)('matches the adjustment shader: %o', (filters) => {
    withDecoded(PNG, (image) => {
      expectShaderMatch((set, alpha) => bakedPixels(renderer, image, set, alpha), image, filters)
    })
  })

  test('keeps fully transparent pixels as they were', () => {
    withDecoded(PNG, (image) => {
      const source = readImage(image, 'unpremultiplied')
      const baked = bakedPixels(renderer, image, ALL_SEVEN, 'unpremultiplied')
      expect(largestDifference(baked, source, isTransparent)).toBe(0)
    })
  })

  test('adjusts an image of one colour', () => {
    const pixels = new Uint8Array(8 * 8 * 4)
    for (let at = 0; at < pixels.length; at += 4) {
      pixels.set([180, 90, 40, OPAQUE], at)
    }
    withDecoded(encode(pixels, 8, 8), (image) => {
      expectBakeMatchesShader(renderer, image, ALL_SEVEN)
    })
  })

  test('adjusts more distinct colours than one palette row holds', () => {
    const width = 128
    const height = Math.ceil((PALETTE_ROW * 2 + 1) / width)
    withDecoded(encode(distinctPixels(width * height), width, height), (image) => {
      expectBakeMatchesShader(renderer, image, ALL_SEVEN)
      expectBakeMatchesShader(renderer, image, { tint: -1 })
    })
  })

  test('adjusts in sRGB whatever colour space the renderer draws in', () => {
    const memory = ck.Malloc(Uint8Array, 4)
    const surface = expectDefined(
      ck.MakeRasterDirectSurface(
        { ...pixelInfo(1, 1, 'premultiplied'), colorSpace: ck.ColorSpace.DISPLAY_P3 },
        memory,
        4
      ),
      'Display P3 surface'
    )
    const wide = new SkiaRenderer(ck, surface)
    wide.presentationColorSpace = 'display-p3'
    try {
      withDecoded(PNG, (image) => {
        expectBakeMatchesShader(wide, image, ALL_SEVEN)
      })
    } finally {
      wide.destroy()
      ck.Free(memory)
    }
  })
})

describe('adjusted images in exports', () => {
  test.each(FILTER_SETS)('match the adjustment shader at 1:1: %o', (filters) => {
    withDecoded(PNG, (image) => {
      expectShaderMatch(exportedPixels, image, filters)
    })
  })

  test('draw a filter value that is not a number as the shader does', () => {
    const filters = { exposure: Number.NaN, contrast: 0.5 }
    withDecoded(PNG, (image) => {
      const exported = exportedPixels(filters, 'unpremultiplied')
      const shaded = shaderPixels(renderer, image, filters, 'unpremultiplied')
      expect(largestDifference(exported, shaded, isOpaque)).toBe(0)
    })
  })

  test('adjust an image drawn twice with the same filters once per raster export', () => {
    const { graph, specs } = graphWithLayers([
      { page: 0, filters: { exposure: 0.3 } },
      { page: 0, filters: { exposure: 0.3 } },
      { page: 0, filters: { saturation: -1 } }
    ])
    const made = adjustmentShadersMade(() => {
      expectDefined(
        renderNodesToImage(
          ck,
          renderer,
          graph,
          specs[0].pageId,
          specs.flatMap((spec) => spec.nodeIds),
          { scale: 1, format: 'PNG' }
        ),
        'export'
      )
    })
    expect(made).toBe(2)
  })

  test('adjust each image once per set of filters in a multi-page PDF', () => {
    const { graph, specs } = graphWithLayers([
      { page: 0, filters: { exposure: 0.3 } },
      { page: 0, filters: { exposure: 0.3 } },
      { page: 1, filters: { exposure: 0.3 } },
      { page: 1, filters: { saturation: -1 } }
    ])
    const made = adjustmentShadersMade(() => {
      expectDefined(renderPagesToPDF(renderer, graph, specs), 'PDF')
    })
    expect(made).toBe(2)
  })

  test('adjust an image larger than the image cache once per export', () => {
    const own = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
    own.images.cache = createImageCache(1)
    try {
      const { graph, specs } = graphWithLayers([
        { page: 0, filters: { tint: 1 } },
        { page: 1, filters: { tint: 1 } }
      ])
      const made = adjustmentShadersMade(() => {
        expectDefined(renderPagesToPDF(own, graph, specs), 'PDF')
      })
      expect(made).toBe(1)
    } finally {
      own.destroy()
    }
  })

  test('bake an image only the document holds and keep nothing after the export', () => {
    const own = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
    try {
      const { graph, specs } = graphWithLayers([{ page: 0, filters: { contrast: 1 } }])
      expect(own.images.cache.get(HASH)).toBeUndefined()
      const made = adjustmentShadersMade(() => {
        expectDefined(renderPagesToPDF(own, graph, specs), 'PDF')
      })
      expect(made).toBe(1)
      expect(own.images.exporting).toBeNull()
      expect(own.images.cache.get(HASH)).toBeUndefined()
    } finally {
      own.destroy()
    }
  })

  test('adjust a layer with effects again in an export after the canvas drew it', () => {
    const { graph, specs } = graphWithLayers([{ page: 0, filters: { shadows: 1 }, shadow: true }])
    const [{ nodeIds }] = specs
    const recorder = new ck.PictureRecorder()
    try {
      const canvas = recorder.beginRecording(ck.LTRBRect(0, 0, WIDTH * 2, HEIGHT * 2))
      renderer.renderNode(canvas, graph, nodeIds[0], {})
      recorder.finishRecordingAsPicture().delete()
    } finally {
      recorder.delete()
    }
    const made = adjustmentShadersMade(() => {
      expectDefined(renderPagesToPDF(renderer, graph, specs), 'PDF')
    })
    expect(made).toBe(1)
  })
})

describe('the export scope', () => {
  const { graph, specs } = graphWithLayers([{ page: 0, filters: ALL_SEVEN }])
  const layer = expectDefined(graph.getNode(specs[0].nodeIds[0]), 'layer')

  test('bakes nothing outside an export', () => {
    expect(adjustedImageForExport(renderer, graph, HASH, ALL_SEVEN, layer)).toBeNull()
  })

  test('frees what it baked when the drawing throws', () => {
    const kept: { image: Image | null } = { image: null }
    expect(() =>
      drawingExport(renderer.images, null, () => {
        kept.image = adjustedImageForExport(renderer, graph, HASH, ALL_SEVEN, layer)
        throw new Error('drawing failed')
      })
    ).toThrow('drawing failed')
    expect(expectDefined(kept.image, 'baked image').isDeleted()).toBe(true)
    expect(renderer.images.exporting).toBeNull()
  })

  test('shares one bake across nested exports and frees it when the outer one ends', () => {
    const made = adjustmentShadersMade(() => {
      const baked = drawingExport(renderer.images, null, () => {
        const outer = adjustedImageForExport(renderer, graph, HASH, ALL_SEVEN, layer)
        const nested = drawingExport(renderer.images, null, () =>
          adjustedImageForExport(renderer, graph, HASH, ALL_SEVEN, layer)
        )
        expect(nested).toBe(outer)
        expect(expectDefined(nested, 'baked image').isDeleted()).toBe(false)
        return nested
      })
      expect(expectDefined(baked, 'baked image').isDeleted()).toBe(true)
    })
    expect(made).toBe(1)
  })
})
