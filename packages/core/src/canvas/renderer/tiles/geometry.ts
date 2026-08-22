export const TILE_DEVICE_SIZE = 256
export const TILE_LEVEL_STEP = 0.25

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

export function tileLevel(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return 1
  return Math.max(TILE_LEVEL_STEP, Math.ceil(scale / TILE_LEVEL_STEP) * TILE_LEVEL_STEP)
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
