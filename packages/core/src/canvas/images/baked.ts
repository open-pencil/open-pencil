import type { ColorSpace, Image, ImageInfo } from '@open-pencil/canvaskit'
import type { ImageFilters } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer/skia'

import { makeAdjustedImageShader } from './adjustments'
import { ColorPalette } from './palette'

const BYTES_PER_PIXEL = 4
const ALPHA_BITS = 0xff000000
const COLOR_BITS = 0x00ffffff
export const PALETTE_ROW = 4096

export interface SourcePixels {
  readonly info: ImageInfo
  readonly bytes: Uint8Array
  readonly pixels: Uint32Array
}

function unpremultiplied(
  r: SkiaRenderer,
  width: number,
  height: number,
  colorSpace: ColorSpace
): ImageInfo {
  return {
    width,
    height,
    alphaType: r.ck.AlphaType.Unpremul,
    colorType: r.ck.ColorType.RGBA_8888,
    colorSpace
  }
}

function isTransparent(pixel: number): boolean {
  return (pixel & ALPHA_BITS) === 0
}

function opaque(pixel: number): number {
  return (pixel | ALPHA_BITS) >>> 0
}

function withAlphaOf(color: number, pixel: number): number {
  return ((color & COLOR_BITS) | (pixel & ALPHA_BITS)) >>> 0
}

export function holdsEightBitChannels(r: SkiaRenderer, image: Image): boolean {
  const { ColorType } = r.ck
  const eightBit = [ColorType.RGBA_8888, ColorType.BGRA_8888, ColorType.Gray_8]
  const stored = image.getImageInfo().colorType.value
  return eightBit.some((type) => type.value === stored)
}

export function withSourcePixels<T>(
  r: SkiaRenderer,
  image: Image,
  use: (source: SourcePixels) => T
): T | null {
  const colorSpace = image.getColorSpace()
  try {
    const info = unpremultiplied(r, image.width(), image.height(), colorSpace)
    const bytes = image.readPixels(0, 0, info)
    if (!(bytes instanceof Uint8Array)) {
      return null
    }
    const pixels = new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.length / BYTES_PER_PIXEL)
    return use({ info, bytes, pixels })
  } finally {
    colorSpace.delete()
  }
}

function adjustPalette(
  r: SkiaRenderer,
  palette: ColorPalette,
  colorSpace: ColorSpace,
  filters: ImageFilters
): Uint32Array | null {
  const width = Math.min(PALETTE_ROW, palette.count)
  const height = Math.ceil(palette.count / width)
  const rows = new Uint32Array(width * height)
  rows.set(palette.colors.subarray(0, palette.count))
  const source = r.ck.MakeImage(
    unpremultiplied(r, width, height, colorSpace),
    new Uint8Array(rows.buffer),
    width * BYTES_PER_PIXEL
  )
  const surface = r.ck.MakeSurface(width, height)
  if (!source || !surface) {
    source?.delete()
    surface?.dispose()
    return null
  }
  const sampled = source.makeShaderOptions(
    r.ck.TileMode.Clamp,
    r.ck.TileMode.Clamp,
    r.ck.FilterMode.Nearest,
    r.ck.MipmapMode.None
  )
  const adjusted = makeAdjustedImageShader(r, sampled, filters)
  const paint = new r.ck.Paint()
  try {
    paint.setShader(adjusted)
    paint.setBlendMode(r.ck.BlendMode.Src)
    surface.getCanvas().drawPaint(paint)
    const pixels = surface
      .getCanvas()
      .readPixels(0, 0, unpremultiplied(r, width, height, r.ck.ColorSpace.SRGB))
    return pixels instanceof Uint8Array
      ? new Uint32Array(pixels.buffer, pixels.byteOffset, palette.count)
      : null
  } finally {
    paint.delete()
    adjusted.delete()
    sampled.delete()
    surface.dispose()
    source.delete()
  }
}

function mipmappedImage(r: SkiaRenderer, info: ImageInfo, pixels: Uint8Array): Image | null {
  const flat = r.ck.MakeImage(info, pixels, info.width * BYTES_PER_PIXEL)
  if (!flat) {
    return null
  }
  try {
    return flat.makeCopyWithDefaultMipmaps()
  } finally {
    flat.delete()
  }
}

export function paletteOf(pixels: Uint32Array): ColorPalette {
  const palette = new ColorPalette()
  for (const pixel of pixels) {
    if (!isTransparent(pixel)) {
      palette.add(opaque(pixel))
    }
  }
  return palette
}

export function bakeFromPalette(
  r: SkiaRenderer,
  source: SourcePixels,
  palette: ColorPalette,
  filters: ImageFilters
): Image | null {
  const { info, bytes, pixels } = source
  if (palette.count === 0) {
    return mipmappedImage(r, info, bytes)
  }
  const adjusted = adjustPalette(r, palette, info.colorSpace, filters)
  if (!adjusted) {
    return null
  }
  for (let at = 0; at < pixels.length; at++) {
    const pixel = pixels[at]
    if (!isTransparent(pixel)) {
      pixels[at] = withAlphaOf(adjusted[palette.indexOf(opaque(pixel))], pixel)
    }
  }
  return mipmappedImage(r, { ...info, colorSpace: r.ck.ColorSpace.SRGB }, bytes)
}

export function bakeAdjustedImage(
  r: SkiaRenderer,
  image: Image,
  filters: ImageFilters
): Image | null {
  return withSourcePixels(r, image, (source) =>
    bakeFromPalette(r, source, paletteOf(source.pixels), filters)
  )
}
