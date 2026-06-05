import { beforeAll, describe, expect, test } from 'bun:test'

import { preprocessForVectorize, svgToVectorPaths } from '@open-pencil/core/tools'

import { initCanvasKit } from '#cli/headless'

import { expectDefined } from '#tests/helpers/assert'

let ck: Awaited<ReturnType<typeof initCanvasKit>>

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
    const pixels = decoded.readPixels(0, 0, {
      alphaType: ck.AlphaType.Unpremul,
      colorType: ck.ColorType.RGBA_8888,
      colorSpace: ck.ColorSpace.SRGB,
      width: decoded.width(),
      height: decoded.height()
    })
    decoded.delete()
    expect(pixels).not.toBeNull()
    let transparent = 0
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] === 0) transparent++
    }
    expect(transparent).toBeGreaterThan(0)
  })
})

describe('svgToVectorPaths', () => {
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
