import type { CachedTile, TileImageCache } from './cache'
import {
  type TileKey,
  type TileWorldBounds,
  tileKeysForWorldBounds,
  tileKeyString
} from './geometry'
import type { TileJob } from './scheduler'

export interface TilePlanOptions {
  pageId: string
  level: number
  viewport: TileWorldBounds
  overscanTiles: number
  navigationGeneration: number
  contentGeneration: number
  estimateCost: (key: TileKey) => number
  globalFallbackAvailable?: boolean
}

export interface TilePlan {
  jobs: TileJob[]
  visible: Array<{ key: TileKey; tile: CachedTile | null }>
}

function expand(bounds: TileWorldBounds, amount: number): TileWorldBounds {
  return {
    minX: bounds.minX - amount,
    minY: bounds.minY - amount,
    maxX: bounds.maxX + amount,
    maxY: bounds.maxY + amount
  }
}

export function planTiles(cache: TileImageCache, options: TilePlanOptions): TilePlan {
  const worldTileSize = 256 / options.level
  const visibleKeys = tileKeysForWorldBounds(options.pageId, options.level, options.viewport)
  const visibleIds = new Set(visibleKeys.map(tileKeyString))
  const overscanKeys = tileKeysForWorldBounds(
    options.pageId,
    options.level,
    expand(options.viewport, worldTileSize * options.overscanTiles)
  )
  const visible = visibleKeys.map((key) => ({ key, tile: cache.get(key) }))
  const jobs: TileJob[] = []
  for (const { key, tile } of visible) {
    const fresh = tile?.contentGeneration === options.contentGeneration
    if (fresh) continue
    jobs.push({
      key,
      navigationGeneration: options.navigationGeneration,
      contentGeneration: options.contentGeneration,
      priority: tile || options.globalFallbackAvailable ? 'visible' : 'mandatory',
      fallbackAvailable: tile !== null || options.globalFallbackAvailable === true,
      estimatedCost: options.estimateCost(key)
    })
  }
  for (const key of overscanKeys) {
    if (visibleIds.has(tileKeyString(key))) continue
    const tile = cache.get(key)
    if (tile?.contentGeneration === options.contentGeneration) continue
    jobs.push({
      key,
      navigationGeneration: options.navigationGeneration,
      contentGeneration: options.contentGeneration,
      priority: 'overscan',
      fallbackAvailable: tile !== null,
      estimatedCost: options.estimateCost(key)
    })
  }
  return { jobs, visible }
}
