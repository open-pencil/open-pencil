import { beforeAll, describe, expect, test } from 'bun:test'

import {
  preprocessForVectorize,
  renderVectorizeComparison,
  svgToVectorPaths
} from '@open-pencil/core/tools'

import { initCanvasKit } from '#cli/headless'

import { expectDefined } from '#tests/helpers/assert'
import { testPath } from '#tests/helpers/paths'

let ck: Awaited<ReturnType<typeof initCanvasKit>>

const VECTORIZE_FIXTURES = testPath('fixtures/vectorize')

async function loadFixturePng(name: string): Promise<Uint8Array> {
  const buf = await Bun.file(`${VECTORIZE_FIXTURES}/${name}`).arrayBuffer()
  return new Uint8Array(buf)
}

function countTransparentPixels(
  image: NonNullable<ReturnType<typeof ck.MakeImageFromEncoded>>
): number {
  const pixels = image.readPixels(0, 0, {
    alphaType: ck.AlphaType.Unpremul,
    colorType: ck.ColorType.RGBA_8888,
    colorSpace: ck.ColorSpace.SRGB,
    width: image.width(),
    height: image.height()
  })
  if (!pixels) return 0
  let transparent = 0
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] === 0) transparent++
  }
  return transparent
}

function createPng(width: number, height: number, alpha = 255): Uint8Array {
  const pixels = ck.Malloc(Uint8Array, width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const offset = i * 4
    pixels[offset] = 80
    pixels[offset + 1] = 120
    pixels[offset + 2] = 200
    pixels[offset + 3] = alpha
  }
  const surface = ck.MakeRasterDirectSurface(
    {
      alphaType: ck.AlphaType.Unpremul,
      colorType: ck.ColorType.RGBA_8888,
      colorSpace: ck.ColorSpace.SRGB,
      width,
      height
    },
    pixels,
    width * 4
  )
  if (!surface) throw new Error('Failed to create surface')
  const image = surface.makeImageSnapshot()
  const encoded = image.encodeToBytes(ck.ImageFormat.PNG, 100)
  image.delete()
  surface.delete()
  ck.Free(pixels)
  if (!encoded) throw new Error('Failed to encode PNG')
  return new Uint8Array(encoded)
}

beforeAll(async () => {
  ck = await initCanvasKit()
})

describe('preprocessForVectorize', () => {
  test('leaves images at or above 256px short side unchanged', () => {
    const bytes = createPng(400, 300)
    const result = preprocessForVectorize(bytes, () => ck)
    expect(result).not.toBeNull()
    expect(result?.width).toBe(400)
    expect(result?.height).toBe(300)
    expect(result?.originalWidth).toBe(400)
    expect(result?.originalHeight).toBe(300)
  })

  test('upscales images below 256px short side', () => {
    const bytes = createPng(100, 200)
    const result = preprocessForVectorize(bytes, () => ck)
    expect(result).not.toBeNull()
    expect(Math.min(result?.width ?? 0, result?.height ?? 0)).toBeGreaterThanOrEqual(256)
  })

  test('preserves alpha channel', () => {
    const bytes = createPng(128, 128, 0)
    const result = preprocessForVectorize(bytes, () => ck)
    const processed = expectDefined(result, 'preprocess result')
    const decoded = expectDefined(ck.MakeImageFromEncoded(processed.pngBytes), 'decoded png')
    expect(countTransparentPixels(decoded)).toBeGreaterThan(0)
    decoded.delete()
  })
})

describe('preprocessForVectorize fixtures', () => {
  test('python_logo.png upscales short side below 256px', async () => {
    const bytes = await loadFixturePng('python_logo.png')
    const source = expectDefined(ck.MakeImageFromEncoded(bytes), 'source png')
    expect(source.width()).toBe(580)
    expect(source.height()).toBe(164)
    source.delete()

    const result = preprocessForVectorize(bytes, () => ck)
    const processed = expectDefined(result, 'preprocess result')
    expect(processed.originalWidth).toBe(580)
    expect(processed.originalHeight).toBe(164)
    expect(Math.min(processed.width, processed.height)).toBeGreaterThanOrEqual(256)
    expect(processed.width).toBeGreaterThan(580)
    expect(processed.height).toBe(256)
  })

  test('euro_shield.png keeps dimensions and alpha', async () => {
    const bytes = await loadFixturePng('euro_shield.png')
    const result = preprocessForVectorize(bytes, () => ck)
    const processed = expectDefined(result, 'preprocess result')
    expect(processed.width).toBe(577)
    expect(processed.height).toBe(721)

    const decoded = expectDefined(ck.MakeImageFromEncoded(processed.pngBytes), 'decoded png')
    expect(countTransparentPixels(decoded)).toBeGreaterThan(0)
    decoded.delete()
  })

  test('pilot_avatar.png keeps dimensions without upscale', async () => {
    const bytes = await loadFixturePng('pilot_avatar.png')
    const result = preprocessForVectorize(bytes, () => ck)
    const processed = expectDefined(result, 'preprocess result')
    expect(processed.width).toBe(412)
    expect(processed.height).toBe(364)
    expect(Math.min(processed.width, processed.height)).toBeGreaterThanOrEqual(256)

    const decoded = expectDefined(ck.MakeImageFromEncoded(processed.pngBytes), 'decoded png')
    expect(countTransparentPixels(decoded)).toBeGreaterThan(0)
    decoded.delete()
  })

  test('sander_test_01.png preprocesses opaque illustration', async () => {
    const bytes = await loadFixturePng('sander_test_01.png')
    const source = expectDefined(ck.MakeImageFromEncoded(bytes), 'source png')
    expect(source.width()).toBe(417)
    expect(source.height()).toBe(391)
    const sourceTransparent = countTransparentPixels(source)
    source.delete()

    const result = preprocessForVectorize(bytes, () => ck)
    const processed = expectDefined(result, 'preprocess result')
    expect(processed.width).toBe(417)
    expect(processed.height).toBe(391)
    expect(processed.pngBytes.length).toBeGreaterThan(0)
    expect(processed.pngBytes.length).toBeLessThanOrEqual(5 * 1024 * 1024)
    expect(sourceTransparent).toBe(0)
  })
})

describe('svgToVectorPaths', () => {
  test('maps multi-path vendor SVG with viewBox larger than width/height attrs', () => {
    const svg = `<svg viewBox="0 0 1000 800" width="200" height="160" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 0 H1000 V800 H0 Z" fill="#336699"/>
      <path d="M100 100 H400 V400 H100 Z" fill="#ffcc00"/>
      <path d="M600 200 H900 V500 H600 Z" fill="#ffcc00"/>
    </svg>`
    const result = svgToVectorPaths(svg, { width: 200, height: 160 })
    expect(result?.paths.length).toBe(3)

    let maxX = 0
    let maxY = 0
    for (const path of result?.paths ?? []) {
      for (const vertex of path.vectorNetwork.vertices) {
        maxX = Math.max(maxX, vertex.x)
        maxY = Math.max(maxY, vertex.y)
      }
    }
    expect(maxX).toBeCloseTo(200, 0)
    expect(maxY).toBeCloseTo(160, 0)
  })

  test('maps viewBox paths onto target bounds', () => {
    const svg = `<svg viewBox="0 0 100 50" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 0 H100 V50 H0 Z" fill="#336699"/>
    </svg>`
    const result = svgToVectorPaths(svg, { width: 200, height: 100 })
    expect(result?.paths.length).toBe(1)
    const path = expectDefined(result?.paths[0], 'vector path')
    expect(path.fills[0]?.type).toBe('SOLID')
    const maxX = Math.max(...path.vectorNetwork.vertices.map((vertex) => vertex.x))
    expect(maxX).toBeCloseTo(200, 0)
  })

  test('uses viewBox user units when width/height attributes differ', () => {
    const svg = `<svg width="240" height="300" viewBox="0 0 100 125" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 0 H100 V125 H0 Z" fill="#003399"/>
    </svg>`
    const result = svgToVectorPaths(svg, { width: 240, height: 300 })
    const path = expectDefined(result?.paths[0], 'vector path')
    const maxX = Math.max(...path.vectorNetwork.vertices.map((vertex) => vertex.x))
    const maxY = Math.max(...path.vectorNetwork.vertices.map((vertex) => vertex.y))
    expect(maxX).toBeCloseTo(240, 0)
    expect(maxY).toBeCloseTo(300, 0)
  })

  test('maps viewBox with non-zero origin into target bounds', () => {
    const svg = `<svg viewBox="50 50 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 50 H150 V150 H50 Z" fill="#336699"/>
    </svg>`
    const result = svgToVectorPaths(svg, { width: 200, height: 200 })
    const path = expectDefined(result?.paths[0], 'vector path')
    const minX = Math.min(...path.vectorNetwork.vertices.map((vertex) => vertex.x))
    const minY = Math.min(...path.vectorNetwork.vertices.map((vertex) => vertex.y))
    const maxX = Math.max(...path.vectorNetwork.vertices.map((vertex) => vertex.x))
    const maxY = Math.max(...path.vectorNetwork.vertices.map((vertex) => vertex.y))
    expect(minX).toBeCloseTo(0, 0)
    expect(minY).toBeCloseTo(0, 0)
    expect(maxX).toBeCloseTo(200, 0)
    expect(maxY).toBeCloseTo(200, 0)
  })

  test('scales cubic control points under non-uniform viewBox mapping', () => {
    const svg = `<svg viewBox="0 0 100 200" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 100 C40 0, 60 200, 100 100" fill="#336699"/>
    </svg>`
    const result = svgToVectorPaths(svg, { width: 300, height: 100 })
    const segment = expectDefined(result?.paths[0]?.vectorNetwork.segments[0], 'cubic segment')
    expect(segment.tangentStart.x).toBeCloseTo(120, 0)
    expect(segment.tangentStart.y).toBeCloseTo(-50, 0)
    expect(segment.tangentEnd.x).toBeCloseTo(-120, 0)
    expect(segment.tangentEnd.y).toBeCloseTo(50, 0)
  })

  test('applies path transform before viewBox mapping', () => {
    const svg = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path transform="translate(10, 20)" d="M0 0 H50 V50 H0 Z" fill="#336699"/>
    </svg>`
    const result = svgToVectorPaths(svg, { width: 200, height: 200 })
    const path = expectDefined(result?.paths[0], 'vector path')
    const minX = Math.min(...path.vectorNetwork.vertices.map((vertex) => vertex.x))
    const minY = Math.min(...path.vectorNetwork.vertices.map((vertex) => vertex.y))
    const maxX = Math.max(...path.vectorNetwork.vertices.map((vertex) => vertex.x))
    const maxY = Math.max(...path.vectorNetwork.vertices.map((vertex) => vertex.y))
    expect(minX).toBeCloseTo(20, 0)
    expect(minY).toBeCloseTo(40, 0)
    expect(maxX).toBeCloseTo(120, 0)
    expect(maxY).toBeCloseTo(140, 0)
  })

  test('reports tight content bounds inside target bounds', () => {
    const svg = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M25 25 H75 V75 H25 Z" fill="#ffcc00"/>
    </svg>`
    const result = svgToVectorPaths(svg, { width: 200, height: 200 })
    const bounds = expectDefined(result?.contentBounds, 'content bounds')
    expect(bounds.x).toBeCloseTo(50, 0)
    expect(bounds.y).toBeCloseTo(50, 0)
    expect(bounds.width).toBeCloseTo(100, 0)
    expect(bounds.height).toBeCloseTo(100, 0)
  })

  test('import render matches raw SVG geometry for vendor-style viewBox SVG', () => {
    const svg = `<svg viewBox="0 0 1000 800" width="200" height="160" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 0 C400 0, 600 800, 1000 800 L1000 0 Z" fill="#0f66e4"/>
      <path d="M100 100 C250 120, 350 500, 500 600 L100 600 Z" fill="#024fac"/>
      <path d="M700 200 H850 V350 H700 Z" fill="#fed20f"/>
    </svg>`
    const result = renderVectorizeComparison(ck, svg, { width: 200, height: 160 })
    const comparison = expectDefined(result, 'vectorize comparison')
    expect(comparison.metrics.pathCount).toBe(3)
    expect(comparison.metrics.identical).toBe(true)
    expect(comparison.metrics.differentPixels).toBe(0)
  })

  test('resolves objectBoundingBox linearGradient reference to a GRADIENT_LINEAR fill', () => {
    const svg = `<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient>
      </defs>
      <path d="M0 0 H10 V10 H0 Z" fill="url(#g)"/>
    </svg>`
    const result = svgToVectorPaths(svg, { width: 10, height: 10 })
    const fill = expectDefined(result?.paths[0]?.fills[0], 'gradient fill')
    expect(fill.type).toBe('GRADIENT_LINEAR')
    expect(fill.gradientStops?.length).toBe(2)
    expect(fill.gradientStops?.[0]?.color.r).toBeCloseTo(0, 2)
    expect(fill.gradientStops?.[1]?.color.r).toBeCloseTo(1, 2)
    expect(fill.gradientTransform).toBeDefined()
  })

  test('resolves Recraft-style userSpaceOnUse gradient with two stops', () => {
    // Mirrors Recraft vectorize output: userSpaceOnUse coords across the node box.
    const svg = `<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="Gradient1" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="0">
          <stop offset="0" stop-color="#3572b0"/>
          <stop offset="1" stop-color="#ffd43b"/>
        </linearGradient>
      </defs>
      <path d="M0 0 H100 V100 H0 Z" fill="url(#Gradient1)"/>
    </svg>`
    const result = svgToVectorPaths(svg, { width: 100, height: 100 })
    const fill = expectDefined(result?.paths[0]?.fills[0], 'gradient fill')
    expect(fill.type).toBe('GRADIENT_LINEAR')
    expect(fill.gradientStops?.[0]?.color.b).toBeCloseTo(176 / 255, 2)
    expect(fill.gradientStops?.[1]?.color.r).toBeCloseTo(1, 2)
    // horizontal axis across the node box: start x≈0, end x≈1
    const t = expectDefined(fill.gradientTransform, 'gradient transform')
    expect(t.m02).toBeCloseTo(0, 1)
    expect(t.m00 + t.m02).toBeCloseTo(1, 1)
  })

  test('still resolves a solid color fill alongside gradients', () => {
    const svg = `<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 0 H10 V10 H0 Z" fill="#e1e1e1"/>
    </svg>`
    const result = svgToVectorPaths(svg, { width: 10, height: 10 })
    const fill = expectDefined(result?.paths[0]?.fills[0], 'solid fill')
    expect(fill.type).toBe('SOLID')
    expect(fill.color.r).toBeCloseTo(225 / 255, 2)
  })
})
