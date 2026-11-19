import { spyOn } from 'bun:test'

import type { ColorSpace, Image } from '@open-pencil/canvaskit'
import type { ImageFilters } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { makeAdjustedImageShader } from '#core/canvas/images/adjustments'
import type { SkiaRenderer } from '#core/canvas/renderer/skia'
import { getCanvasKit } from '#core/canvaskit'

const ck = await getCanvasKit()

export const OPAQUE = 255
export const ALL_SEVEN: ImageFilters = {
  exposure: 0.25,
  contrast: 0.3,
  saturation: 0.4,
  temperature: -0.3,
  tint: 0.2,
  highlights: -0.4,
  shadows: 0.35
}
const ODD_STRIDE = 7919
const COLOR_BITS = 0xffffff

export type AlphaType = 'premultiplied' | 'unpremultiplied'

export function pixelInfo(
  width: number,
  height: number,
  alpha: AlphaType = 'unpremultiplied',
  colorSpace: ColorSpace = ck.ColorSpace.SRGB
) {
  return {
    width,
    height,
    alphaType: alpha === 'premultiplied' ? ck.AlphaType.Premul : ck.AlphaType.Unpremul,
    colorType: ck.ColorType.RGBA_8888,
    colorSpace
  }
}

export function distinctPixels(count: number): Uint8Array {
  const pixels = new Uint8Array(count * 4)
  for (let index = 0; index < count; index++) {
    const color = (index * ODD_STRIDE) & COLOR_BITS
    pixels.set([color & 0xff, (color >>> 8) & 0xff, color >>> 16, OPAQUE], index * 4)
  }
  return pixels
}

export function encode(
  pixels: Uint8Array,
  width: number,
  height: number,
  colorSpace: ColorSpace = ck.ColorSpace.SRGB
): Uint8Array {
  const source = expectDefined(
    ck.MakeImage(pixelInfo(width, height, 'unpremultiplied', colorSpace), pixels, width * 4),
    'source image'
  )
  try {
    return expectDefined(source.encodeToBytes(ck.ImageFormat.PNG, 100), 'source PNG')
  } finally {
    source.delete()
  }
}

export function withDecoded<T>(png: Uint8Array, use: (image: Image) => T): T {
  const image = expectDefined(ck.MakeImageFromEncoded(png), 'decoded image')
  try {
    return use(image)
  } finally {
    image.delete()
  }
}

export function imageFill(imageHash: string, filters: ImageFilters) {
  return {
    type: 'IMAGE' as const,
    color: { r: 0, g: 0, b: 0, a: 1 },
    opacity: 1,
    visible: true,
    imageHash,
    imageScaleMode: 'FILL' as const,
    filters
  }
}

function eightBit(pixels: Uint8Array | Float32Array | null): Uint8Array {
  if (!(pixels instanceof Uint8Array)) {
    throw new TypeError('expected 8-bit pixels')
  }
  return pixels
}

export function readImage(image: Image, alpha: AlphaType): Uint8Array {
  return eightBit(image.readPixels(0, 0, pixelInfo(image.width(), image.height(), alpha)))
}

export function readEncoded(png: Uint8Array, alpha: AlphaType): Uint8Array {
  return withDecoded(png, (image) => readImage(image, alpha))
}

export function shaderPixels(
  renderer: SkiaRenderer,
  image: Image,
  filters: ImageFilters,
  alpha: AlphaType
): Uint8Array {
  const width = image.width()
  const height = image.height()
  const memory = ck.Malloc(Uint8Array, width * height * 4)
  const surface = expectDefined(
    ck.MakeRasterDirectSurface(pixelInfo(width, height, 'premultiplied'), memory, width * 4),
    'surface'
  )
  const sampled = image.makeShaderOptions(
    ck.TileMode.Clamp,
    ck.TileMode.Clamp,
    ck.FilterMode.Nearest,
    ck.MipmapMode.None
  )
  const shader = makeAdjustedImageShader(renderer, sampled, filters)
  const paint = new ck.Paint()
  try {
    paint.setShader(shader)
    surface.getCanvas().clear(ck.TRANSPARENT)
    surface.getCanvas().drawPaint(paint)
    return eightBit(surface.getCanvas().readPixels(0, 0, pixelInfo(width, height, alpha)))
  } finally {
    paint.delete()
    shader.delete()
    sampled.delete()
    surface.dispose()
    ck.Free(memory)
  }
}

export function largestDifference(
  actual: Uint8Array,
  expected: Uint8Array,
  counts: (alpha: number) => boolean
): number {
  let largest = 0
  for (let at = 0; at < expected.length; at += 4) {
    if (counts(expected[at + 3])) {
      for (let channel = 0; channel < 4; channel++) {
        largest = Math.max(largest, Math.abs(actual[at + channel] - expected[at + channel]))
      }
    }
  }
  return largest
}

export const isOpaque = (alpha: number) => alpha === OPAQUE
export const isTranslucent = (alpha: number) => alpha > 0 && alpha < OPAQUE
export const isTransparent = (alpha: number) => alpha === 0

export function callsDuring<T extends object, K extends keyof T>(
  owner: T,
  method: K,
  job: () => void
): number {
  const spy = spyOn(owner, method)
  try {
    job()
    return spy.mock.calls.length
  } finally {
    spy.mockRestore()
  }
}
