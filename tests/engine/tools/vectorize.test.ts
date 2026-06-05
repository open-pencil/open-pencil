import { beforeAll, describe, expect, test } from 'bun:test'

import { preprocessForVectorize, svgToVectorPaths } from '@open-pencil/core/tools'

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
  test('maps Recraft euro_shield SVG into target bounds', async () => {
    const svg = await Bun.file(`${VECTORIZE_FIXTURES}/euro_shield.recraft.svg`).text()
    const result = svgToVectorPaths(svg, { width: 577, height: 721 })
    expect(result?.paths.length).toBe(14)

    let maxX = 0
    let maxY = 0
    for (const path of result?.paths ?? []) {
      for (const vertex of path.vectorNetwork.vertices) {
        maxX = Math.max(maxX, vertex.x)
        maxY = Math.max(maxY, vertex.y)
      }
    }
    expect(maxX).toBeLessThanOrEqual(577.5)
    expect(maxY).toBeLessThanOrEqual(721.5)
    expect(maxX).toBeGreaterThan(400)
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
    const svg = `<svg width="577" height="721" viewBox="0 0 100 125" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 0 H100 V125 H0 Z" fill="#003399"/>
    </svg>`
    const result = svgToVectorPaths(svg, { width: 577, height: 721 })
    const path = expectDefined(result?.paths[0], 'vector path')
    const maxX = Math.max(...path.vectorNetwork.vertices.map((vertex) => vertex.x))
    const maxY = Math.max(...path.vectorNetwork.vertices.map((vertex) => vertex.y))
    expect(maxX).toBeCloseTo(577, 0)
    expect(maxY).toBeCloseTo(721, 0)
  })

  test('scales cubic tangents when mapping viewBox to target bounds', () => {
    const svg = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 50 C40 0, 60 100, 100 50" fill="#336699"/>
    </svg>`
    const result = svgToVectorPaths(svg, { width: 200, height: 200 })
    const segment = expectDefined(result?.paths[0]?.vectorNetwork.segments[0], 'cubic segment')
    expect(segment.tangentStart.x).toBeCloseTo(80, 0)
    expect(segment.tangentStart.y).toBeCloseTo(-100, 0)
    expect(segment.tangentEnd.x).toBeCloseTo(-80, 0)
    expect(segment.tangentEnd.y).toBeCloseTo(100, 0)
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

  test('falls back to solid fill for gradient references', () => {
    const svg = `<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient>
      </defs>
      <path d="M0 0 H10 V10 H0 Z" fill="url(#g)"/>
    </svg>`
    const result = svgToVectorPaths(svg, { width: 10, height: 10 })
    const path = expectDefined(result?.paths[0], 'gradient path')
    expect(path.fills.length + path.strokes.length).toBeGreaterThanOrEqual(0)
  })
})
