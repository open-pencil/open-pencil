import type { CachedTile, TileImageCache } from './cache'
import {
  MIN_TILE_LEVEL,
  TILE_DEVICE_SIZE,
  type TileKey,
  type TileWorldBounds,
  tileKeysForWorldBounds,
  tileLevel,
  tileWorldBounds,
  tileKeyString,
  tileWorldSize
} from './geometry'
import { childTileKeys } from './render'
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
  /**
   * A coarser level rendered around the viewport once the visible level and its overscan are
   * complete, so zooming out has scaled tiles to show where the visible level has none.
   */
  backdrop?: { level: number; overscanTiles: number }
  /**
   * The whole page at a level coarse enough to fit a handful of tiles, rendered right after the
   * visible tiles, so any hole inside the page has a stand-in however far a zoom out reaches.
   */
  pageBackdrop?: { level: number; bounds: TileWorldBounds }
  /**
   * Coarser copies of the visible level, each tile downsampled from the four cached tiles twice
   * as fine, built once the visible level and its overscan are complete and up to `levels` deep,
   * so a zoom out always finds a scaled stand-in for what was rendered.
   */
  pyramid?: { levels: number }
}

/** The whole page is kept at a level where its longer side spans this many tiles. */
const PAGE_BACKDROP_TILES = 4

/**
 * The whole page at a level coarse enough to fit PAGE_BACKDROP_TILES along its longer side, or
 * undefined when the visible level is already that coarse. The level depends only on the page,
 * so its tiles stay valid across zooms.
 */
export function pageBackdropPlan(
  bounds: TileWorldBounds | null,
  level: number
): { level: number; bounds: TileWorldBounds } | undefined {
  if (!bounds) return undefined
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1)
  const pageLevel = Math.max(
    MIN_TILE_LEVEL,
    tileLevel((PAGE_BACKDROP_TILES * TILE_DEVICE_SIZE) / span)
  )
  if (pageLevel >= level) return undefined
  return { level: pageLevel, bounds }
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

/**
 * Plans one pyramid level per frame: every tile at half the finest unbuilt level whose four
 * children are fresh in the cache, as cheap downsample jobs. Levels below need the level above
 * first, so the walk stops at the first level with work or with nothing to build from.
 */
function planPyramid(
  cache: TileImageCache,
  options: TilePlanOptions,
  levels: number,
  jobs: TileJob[]
): void {
  for (let depth = 1; depth <= levels; depth++) {
    const childLevel = options.level / 2 ** (depth - 1)
    const parentLevel = options.level / 2 ** depth
    if (parentLevel < MIN_TILE_LEVEL) return
    const planned = new Set<string>()
    let children = 0
    for (const child of cache.tilesAtLevel(options.pageId, childLevel)) {
      if (child.contentGeneration !== options.contentGeneration) continue
      children++
      const key = {
        pageId: options.pageId,
        level: parentLevel,
        x: Math.floor(child.key.x / 2),
        y: Math.floor(child.key.y / 2)
      }
      const id = tileKeyString(key)
      if (planned.has(id)) continue
      if (cache.getIfPresent(key)?.contentGeneration === options.contentGeneration) continue
      const complete = childTileKeys(key).every(
        (childKey) => cache.getIfPresent(childKey)?.contentGeneration === options.contentGeneration
      )
      if (!complete) continue
      planned.add(id)
      jobs.push({
        key,
        kind: 'downsample',
        navigationGeneration: options.navigationGeneration,
        contentGeneration: options.contentGeneration,
        priority: 'overscan',
        fallbackAvailable: true,
        estimatedCost: 0
      })
    }
    if (jobs.length > 0 || children === 0) return
  }
}

function planCachedVisibleTiles(cache: TileImageCache, options: TilePlanOptions): TilePlan {
  const visible = tileKeysForWorldBounds(options.pageId, options.level, options.viewport).map(
    (key) => ({ key, tile: cache.getIfPresent(key) })
  )
  return { jobs: [], visible }
}

function planVisibleJobs(options: TilePlanOptions, visible: TilePlan['visible']): TileJob[] {
  const jobs: TileJob[] = []
  for (const { key, tile } of visible) {
    if (tile?.contentGeneration === options.contentGeneration) continue
    jobs.push({
      key,
      navigationGeneration: options.navigationGeneration,
      contentGeneration: options.contentGeneration,
      priority: tile || options.globalFallbackAvailable ? 'visible' : 'mandatory',
      fallbackAvailable: tile !== null || options.globalFallbackAvailable === true,
      estimatedCost: options.estimateCost(key)
    })
  }
  // Centre out, so what the eye rests on appears first.
  const centreX = (options.viewport.minX + options.viewport.maxX) / 2
  const centreY = (options.viewport.minY + options.viewport.maxY) / 2
  const distance = (key: TileKey) => {
    const bounds = tileWorldBounds(key)
    return Math.hypot(
      (bounds.minX + bounds.maxX) / 2 - centreX,
      (bounds.minY + bounds.maxY) / 2 - centreY
    )
  }
  return jobs.sort((a, b) => distance(a.key) - distance(b.key))
}

function planAreaJobs(
  cache: TileImageCache,
  options: TilePlanOptions,
  level: number,
  bounds: TileWorldBounds
): TileJob[] {
  const jobs: TileJob[] = []
  for (const key of tileKeysForWorldBounds(options.pageId, level, bounds)) {
    const tile = cache.get(key)
    if (tile?.contentGeneration === options.contentGeneration) continue
    jobs.push({
      key,
      navigationGeneration: options.navigationGeneration,
      contentGeneration: options.contentGeneration,
      priority: 'overscan',
      fallbackAvailable: true,
      estimatedCost: options.estimateCost(key)
    })
  }
  return jobs
}

function planRingJobs(
  cache: TileImageCache,
  options: TilePlanOptions,
  level: number,
  overscanTiles: number,
  exclude: ReadonlySet<string>,
  fallbackAvailable: (tile: CachedTile | null) => boolean
): TileJob[] {
  const jobs: TileJob[] = []
  const keys = tileKeysForWorldBounds(
    options.pageId,
    level,
    expand(options.viewport, tileWorldSize(level) * overscanTiles)
  )
  for (const key of keys) {
    if (exclude.has(tileKeyString(key))) continue
    const tile = cache.get(key)
    if (tile?.contentGeneration === options.contentGeneration) continue
    jobs.push({
      key,
      navigationGeneration: options.navigationGeneration,
      contentGeneration: options.contentGeneration,
      priority: 'overscan',
      fallbackAvailable: fallbackAvailable(tile),
      estimatedCost: options.estimateCost(key)
    })
  }
  return jobs
}

/**
 * The frame's tile jobs, one stage at a time: stale or missing visible tiles, then the whole
 * page at a coarse level, then the overscan ring, then the pyramid, then the coarse backdrop
 * ring; a later stage is planned only once the earlier ones have nothing left.
 */
export function planTiles(
  cache: TileImageCache,
  options: TilePlanOptions,
  cachedOnly = false
): TilePlan {
  if (cachedOnly) return planCachedVisibleTiles(cache, options)
  const visibleKeys = tileKeysForWorldBounds(options.pageId, options.level, options.viewport)
  const visible = visibleKeys.map((key) => ({ key, tile: cache.get(key) }))
  let jobs = planVisibleJobs(options, visible)
  if (jobs.length === 0 && options.pageBackdrop) {
    jobs = planAreaJobs(cache, options, options.pageBackdrop.level, options.pageBackdrop.bounds)
  }
  if (jobs.length === 0) {
    const visibleIds = new Set(visibleKeys.map(tileKeyString))
    jobs = planRingJobs(
      cache,
      options,
      options.level,
      options.overscanTiles,
      visibleIds,
      (tile) => tile !== null
    )
  }
  if (jobs.length === 0 && options.pyramid) {
    planPyramid(cache, options, options.pyramid.levels, jobs)
  }
  if (jobs.length === 0 && options.backdrop) {
    jobs = planRingJobs(
      cache,
      options,
      options.backdrop.level,
      options.backdrop.overscanTiles,
      new Set(),
      () => true
    )
  }
  return { jobs, visible }
}
