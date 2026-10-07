import pixelmatch from 'pixelmatch'

import type { RasterCodec } from './pixels'

export interface PixelComparison {
  width: number
  height: number
  changedPixels: number
  totalPixels: number
  /** Changed pixels in the highlight color over transparency, as a PNG; null when none. */
  mask: Uint8Array | null
}

export interface PixelComparisonOptions {
  /** Per-pixel color tolerance from 0 to 1 (pixelmatch's threshold). */
  threshold?: number
  highlight?: [number, number, number]
}

/** Compares two equally sized PNGs pixel by pixel, ignoring anti-aliasing noise. */
export function comparePNGs(
  codec: RasterCodec,
  before: Uint8Array,
  after: Uint8Array,
  options: PixelComparisonOptions = {}
): PixelComparison | null {
  const left = codec.decode(before)
  const right = codec.decode(after)
  if (!left || !right || left.width !== right.width || left.height !== right.height) return null
  const { width, height } = left
  const data = new Uint8Array(width * height * 4)
  const changedPixels = pixelmatch(left.data, right.data, data, width, height, {
    threshold: options.threshold ?? 0.1,
    diffColor: options.highlight ?? [255, 51, 102],
    diffMask: true
  })
  return {
    width,
    height,
    changedPixels,
    totalPixels: width * height,
    mask: changedPixels > 0 ? codec.encodePNG({ width, height, data }) : null
  }
}
