/** RGBA buffer helpers shared by the rasterizers and by callers that display raw pixels. */

export interface RenderedPixels {
  /** Unpremultiplied RGBA, ready for `ImageData`. */
  pixels: Uint8Array
  width: number
  height: number
}

/**
 * Primes large enough to skip whole rows. The first that does not divide the row width is
 * used, so consecutive samples land in different columns.
 */
const SAMPLE_STRIDE_PRIMES = [97, 101, 103] as const

function pixelSampleStride(width: number): number {
  return SAMPLE_STRIDE_PRIMES.find((prime) => width % prime !== 0) ?? 1
}

/**
 * True when every sampled pixel of an RGBA buffer is identical — a raster with nothing in it.
 *
 * Sampling steps by whole pixels on a stride coprime with the row width, so a uniform
 * column — a letterbox edge, a gutter — cannot pass for a uniform image. A deliberately
 * solid-colour raster answers true as well; callers that treat the answer as "blank" trade
 * a re-render for never mistaking an empty frame for a real one.
 */
export function isUniformPixels(pixels: Uint8Array, width: number): boolean {
  if (pixels.length < 4) return true
  const stride = pixelSampleStride(width) * 4
  for (let index = stride; index + 3 < pixels.length; index += stride) {
    if (
      pixels[index] !== pixels[0] ||
      pixels[index + 1] !== pixels[1] ||
      pixels[index + 2] !== pixels[2] ||
      pixels[index + 3] !== pixels[3]
    ) {
      return false
    }
  }
  return true
}

/** Copy CanvasKit's direct premultiplied buffer into `ImageData`-ready RGBA bytes. */
export function copyAndUnpremultiplyPixels(pixels: Uint8Array): Uint8Array {
  const copied = new Uint8Array(pixels)
  for (let index = 3; index < pixels.length; index += 4) {
    const alpha = pixels[index]
    if (alpha === 255) continue
    if (alpha === 0) {
      copied[index - 3] = 0
      copied[index - 2] = 0
      copied[index - 1] = 0
      continue
    }
    copied[index - 3] = Math.min(255, Math.round((pixels[index - 3] * 255) / alpha))
    copied[index - 2] = Math.min(255, Math.round((pixels[index - 2] * 255) / alpha))
    copied[index - 1] = Math.min(255, Math.round((pixels[index - 1] * 255) / alpha))
  }
  return copied
}
