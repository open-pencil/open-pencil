export const TILE_DEVICE_SIZE = 512
/**
 * Quantized levels are powers of two split into this many steps, so neighbouring levels differ
 * by about 19 % at every zoom and a zoom from 1 % to 20,000 % crosses some sixty, not thousands.
 * The visible level itself is the exact device scale; quantized levels key the coarse backdrop.
 */
export const TILE_LEVEL_STEPS_PER_OCTAVE = 4
export const MIN_TILE_LEVEL = 2 ** -8
export const MAX_TILE_LEVEL = 2 ** 12

export interface TileKey {
  pageId: string
  level: number
  x: number
  y: number
}

export interface TileWorldBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** The level a device scale draws at: the nearest step at or above it. */
export function tileLevel(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return 1
  const steps = Math.ceil(Math.log2(scale) * TILE_LEVEL_STEPS_PER_OCTAVE - 1e-9)
  return Math.min(
    MAX_TILE_LEVEL,
    Math.max(MIN_TILE_LEVEL, 2 ** (steps / TILE_LEVEL_STEPS_PER_OCTAVE))
  )
}

export function tileWorldSize(level: number): number {
  return TILE_DEVICE_SIZE / level
}

export function tileWorldBounds(key: TileKey): TileWorldBounds {
  const size = tileWorldSize(key.level)
  const minX = key.x * size
  const minY = key.y * size
  return { minX, minY, maxX: minX + size, maxY: minY + size }
}

export function tileKeysForWorldBounds(
  pageId: string,
  level: number,
  bounds: TileWorldBounds
): TileKey[] {
  const size = tileWorldSize(level)
  const minX = Math.floor(bounds.minX / size)
  const minY = Math.floor(bounds.minY / size)
  const maxX = Math.ceil(bounds.maxX / size) - 1
  const maxY = Math.ceil(bounds.maxY / size) - 1
  const keys: TileKey[] = []
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) keys.push({ pageId, level, x, y })
  }
  return keys
}

export function tileKeyString(key: TileKey): string {
  return `${key.pageId}:${key.level}:${key.x}:${key.y}`
}

/** Exact levels are keyed to this many bits of the scale's logarithm: stable across float noise. */
const EXACT_LEVEL_BITS = 20

/**
 * The level a settled view renders at: the device scale itself, so tiles draw on whole device
 * pixels without resampling, rounded so a gesture that ends a few ulps from where it began
 * finds its tiles again instead of rendering them anew. Quantized levels serve the backdrop.
 */
export function exactTileLevel(scale: number): number {
  const clamped = Math.min(MAX_TILE_LEVEL, Math.max(MIN_TILE_LEVEL, scale))
  return 2 ** (Math.round(Math.log2(clamped) * 2 ** EXACT_LEVEL_BITS) / 2 ** EXACT_LEVEL_BITS)
}
