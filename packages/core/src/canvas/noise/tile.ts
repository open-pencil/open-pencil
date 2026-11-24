import type { Image } from '@open-pencil/canvaskit'

import { skColorSpace } from '#core/canvas/renderer/colors'
import type { SkiaRenderer } from '#core/canvas/renderer/skia'

/**
 * Cells on each side of a noise tile, which repeats beyond them: wide enough that the repeat lies
 * past a thousand grains, small enough to build in a few milliseconds and keep in 4 MB.
 */
export const NOISE_TILE_CELLS = 1024

/** What a level byte holds: 15 per level, so the 17 levels stay exact through 8 bits. */
export const LEVEL_STEP = 15

/** The step between a cell's possible values, the hash's 32 bits. */
const CELL_VALUE_STEP = 2 ** -32

/** A cell's uniform value from its index and the seed: a 32-bit integer hash. */
function cellValue(x: number, y: number, seed: number, salt: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(seed + salt, 0x9e3779b9)
  h ^= h >>> 16
  h = Math.imul(h, 0x7feb352d)
  h ^= h >>> 15
  h = Math.imul(h, 0x846ca68b)
  h ^= h >>> 16
  return (h >>> 0) * CELL_VALUE_STEP
}

/** The level a uniform value takes under `shares`, the share of pixels at each level or below. */
function level(u: number, shares: readonly number[]): number {
  let at = 0
  while (at < shares.length && u >= shares[at]) at += 1
  return at
}

/**
 * A tile holds data, not colors, so it is tagged with the space of the surfaces it is drawn into,
 * the document's, and Skia samples its bytes as they are.
 */
function cached(r: SkiaRenderer, name: string, build: () => Uint8Array): Image | null {
  const space = r.documentColorSpace
  const key = `${space}:${name}`
  const kept = r.shaders.tiles.get(key)
  if (kept) return kept
  const image = r.ck.MakeImage(
    {
      width: NOISE_TILE_CELLS,
      height: NOISE_TILE_CELLS,
      alphaType: r.ck.AlphaType.Unpremul,
      colorType: r.ck.ColorType.RGBA_8888,
      colorSpace: skColorSpace(r.ck, space)
    },
    build(),
    NOISE_TILE_CELLS * 4
  )
  if (!image) return null
  if (r.shaders.tiles.set(key, image)) return image
  image.delete()
  return null
}

/**
 * Each cell's level under `shares` in red, and the level of its opposite value, which a duotone's
 * second colour shows, in green, as multiples of `LEVEL_STEP`.
 */
export function noiseLevelTile(r: SkiaRenderer, shares: readonly number[], seed: number) {
  return cached(r, `levels:${seed}:${shares.join(',')}`, () => {
    const pixels = new Uint8Array(NOISE_TILE_CELLS * NOISE_TILE_CELLS * 4)
    for (let y = 0; y < NOISE_TILE_CELLS; y++) {
      for (let x = 0; x < NOISE_TILE_CELLS; x++) {
        const u = cellValue(x, y, seed, 0)
        const at = (y * NOISE_TILE_CELLS + x) * 4
        pixels[at] = level(u, shares) * LEVEL_STEP
        // The opposite value, reflected within [0, 1) as the hash is, so no cell reaches 1.
        pixels[at + 1] = level(1 - u - CELL_VALUE_STEP, shares) * LEVEL_STEP
        pixels[at + 3] = 255
      }
    }
    return pixels
  })
}

/** A random colour for each cell of a multitone noise. */
export function noiseColorTile(r: SkiaRenderer, seed: number) {
  return cached(r, `colors:${seed}`, () => {
    const pixels = new Uint8Array(NOISE_TILE_CELLS * NOISE_TILE_CELLS * 4)
    for (let y = 0; y < NOISE_TILE_CELLS; y++) {
      for (let x = 0; x < NOISE_TILE_CELLS; x++) {
        const at = (y * NOISE_TILE_CELLS + x) * 4
        for (let channel = 0; channel < 3; channel++) {
          pixels[at + channel] = Math.floor(cellValue(x, y, seed, channel + 1) * 256)
        }
        pixels[at + 3] = 255
      }
    }
    return pixels
  })
}
