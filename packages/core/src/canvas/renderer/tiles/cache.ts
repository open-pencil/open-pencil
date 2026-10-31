import type { Image as CKImage } from 'canvaskit-wasm'

import { intersectVisualBounds } from '@open-pencil/scene-graph/geometry'

import { ResourceCache } from '#core/cache/resource'

import {
  TILE_DEVICE_SIZE,
  tileKeysForWorldBounds,
  tileKeyString,
  tileWorldBounds,
  tileWorldSize,
  type TileKey,
  type TileWorldBounds
} from './geometry'
import type { RenderedTile } from './render'

export interface CachedTile {
  key: TileKey
  /** Null for a tile with nothing in it: it draws as the page colour and holds no texture. */
  image: CKImage | null
  contentGeneration: number
  lastUsed: number
  bytes: number
}

const DEFAULT_MAX_TILE_BYTES = 128 * 1024 * 1024
const MAXIMUM_TILE_CACHE_BYTES = 768 * 1024 * 1024
const TILE_BYTES = TILE_DEVICE_SIZE * TILE_DEVICE_SIZE * 4
/**
 * The budget holds this many viewports' worth of tiles: the visible level with its overscan
 * ring, the level a zoom just left, the pyramid, the backdrop ring, and the page copy, so idle
 * work never evicts what the next frame draws.
 */
const TILE_CACHE_VIEWPORTS = 5

/** The bytes of the tiles a viewport of this many device pixels can touch. */
export function viewportTileBytes(widthPx: number, heightPx: number): number {
  return (
    (Math.ceil(widthPx / TILE_DEVICE_SIZE) + 1) *
    (Math.ceil(heightPx / TILE_DEVICE_SIZE) + 1) *
    TILE_BYTES
  )
}

/** The cache's byte budget for a viewport whose tiles weigh `viewportBytes`. */
export function viewportTileCacheBudget(viewportBytes: number): number {
  return Math.min(
    MAXIMUM_TILE_CACHE_BYTES,
    Math.max(DEFAULT_MAX_TILE_BYTES, viewportBytes * TILE_CACHE_VIEWPORTS)
  )
}

/** Levels are compared by zoom distance; a finer level wins a tie, as it stays sharp scaled down. */
function compareLevelDistance(target: number) {
  return (a: number, b: number) =>
    Math.abs(Math.log2(a / target)) - Math.abs(Math.log2(b / target)) || b - a
}

/**
 * A finer level stands in for a missing tile with (ratio)² of its own, so the ratio is capped:
 * past it the lookup would enumerate thousands of keys per tile on every frame of a zoom out.
 * A coarser level always covers a tile with at most four.
 */
const MAX_FINER_FALLBACK_RATIO = 8
/** How many partial levels a hole may layer over the nearest level that covers all of it. */
const MAX_PARTIAL_FALLBACK_LAYERS = 2

export class TileImageCache {
  private readonly entries: ResourceCache<string, CachedTile>
  /** The tiles of each page by level, so fallback lookups and the pyramid walk only what exists. */
  private readonly entriesByLevel = new Map<string, Map<number, Map<string, CachedTile>>>()
  private clock = 0
  /** Levels whose evictions the controller counts: those its current plan still needs. */
  private watchedLevels: ReadonlySet<number> = new Set()
  private watchedEvictions = 0

  constructor(maxBytes = DEFAULT_MAX_TILE_BYTES) {
    this.entries = new ResourceCache({
      maxWeight: maxBytes,
      // An empty tile weighs one byte: the cache refuses weightless entries.
      weight: (entry) => Math.max(1, entry.bytes),
      dispose: (entry, _id, reason) => {
        if (reason === 'evict' && this.watchedLevels.has(entry.key.level)) this.watchedEvictions++
        this.forgetLevelEntry(entry)
        entry.image?.delete()
      }
    })
  }

  /** The byte budget; tiles past it are evicted least recently used first. */
  budget(): number {
    return this.entries.capacity
  }

  setBudget(bytes: number): void {
    if (bytes !== this.entries.capacity) this.entries.resize(bytes)
  }

  /** Counts evictions of tiles at `levels` from now on. */
  watchLevels(levels: ReadonlySet<number>): void {
    this.watchedLevels = levels
  }

  /** Evictions of watched levels since the last call. */
  takeWatchedEvictions(): number {
    const count = this.watchedEvictions
    this.watchedEvictions = 0
    return count
  }

  private rememberLevelEntry(id: string, entry: CachedTile): void {
    const levels =
      this.entriesByLevel.get(entry.key.pageId) ?? new Map<number, Map<string, CachedTile>>()
    const tiles = levels.get(entry.key.level) ?? new Map<string, CachedTile>()
    tiles.set(id, entry)
    levels.set(entry.key.level, tiles)
    this.entriesByLevel.set(entry.key.pageId, levels)
  }

  private forgetLevelEntry(entry: CachedTile): void {
    const levels = this.entriesByLevel.get(entry.key.pageId)
    const tiles = levels?.get(entry.key.level)
    if (!levels || !tiles) return
    tiles.delete(tileKeyString(entry.key))
    if (tiles.size === 0) levels.delete(entry.key.level)
    if (levels.size === 0) this.entriesByLevel.delete(entry.key.pageId)
  }

  /**
   * Marks every tile of `level` as used now, so it is evicted after everything else: the page
   * copy is the stand-in of last resort, and a zoom that renders through the budget must not
   * lose it to tiles it will discard at the next step.
   */
  touchLevel(pageId: string, level: number): void {
    const tiles = this.entriesByLevel.get(pageId)?.get(level)
    if (!tiles) return
    for (const id of tiles.keys()) {
      const entry = this.entries.get(id)
      if (entry) entry.lastUsed = ++this.clock
    }
  }

  /** The cached tiles of one level of a page, in no particular order. */
  tilesAtLevel(pageId: string, level: number): Iterable<CachedTile> {
    return this.entriesByLevel.get(pageId)?.get(level)?.values() ?? []
  }

  /** The levels `findFallback` may draw from for a page shown at `level`, nearest first. */
  fallbackLevels(pageId: string, level: number): number[] {
    return [...(this.entriesByLevel.get(pageId)?.keys() ?? [])]
      .filter((candidate) => candidate < level || candidate / level <= MAX_FINER_FALLBACK_RATIO)
      .filter((candidate) => candidate !== level)
      .sort(compareLevelDistance(level))
  }

  /**
   * Cached tiles of other levels that stand in for `key`'s missing tile, scaled, in drawing
   * order: the nearest level that covers all of the area first, then the nearer partial levels
   * over it, nearest last, so the sharpest content ends on top and the complete level fills
   * whatever the partial ones miss. The area is the tile's overlap with `content`, the page's
   * bounds, so the page copy counts as complete under a tile that reaches past the page; a tile
   * off the page keeps its own area. The search passes over partial levels beyond the layered ones until it finds a complete one, so
   * a hole shows the page copy rather than the page colour. Null when no level has a tile there.
   */
  findFallback(
    key: TileKey,
    levels: number[],
    content: TileWorldBounds | null = null
  ): CachedTile[] | null {
    const bounds = tileWorldBounds(key)
    // A tile off the page keeps its own area.
    const area = content ? (intersectVisualBounds(bounds, content) ?? bounds) : bounds
    // Shrink by a hair so a boundary shared with the next tile does not ask for that tile too.
    const inset = {
      minX: area.minX + 1e-6,
      minY: area.minY + 1e-6,
      maxX: area.maxX - 1e-6,
      maxY: area.maxY - 1e-6
    }
    const partial: CachedTile[][] = []
    let base: CachedTile[] | null = null
    for (const level of levels) {
      const tiles: CachedTile[] = []
      let complete = true
      for (const candidate of tileKeysForWorldBounds(key.pageId, level, inset)) {
        const tile = this.get(candidate)
        if (tile) tiles.push(tile)
        else complete = false
      }
      if (tiles.length === 0) continue
      if (complete) {
        base = tiles
        break
      }
      if (partial.length < MAX_PARTIAL_FALLBACK_LAYERS) partial.push(tiles)
    }
    if (!base && partial.length === 0) return null
    return [...(base ?? []), ...partial.reverse().flat()]
  }

  get(key: TileKey): CachedTile | null {
    const id = tileKeyString(key)
    const entry = this.entries.get(id)
    if (!entry) return null
    entry.lastUsed = ++this.clock
    return entry
  }

  getIfPresent(key: TileKey): CachedTile | null {
    return this.entries.peek(tileKeyString(key)) ?? null
  }

  install(tile: RenderedTile, contentGeneration: number): CachedTile | null {
    const id = tileKeyString(tile.key)
    const entry: CachedTile = {
      key: tile.key,
      image: tile.image,
      contentGeneration,
      lastUsed: ++this.clock,
      bytes: tile.image ? tile.image.width() * tile.image.height() * 4 : 0
    }
    if (!this.entries.set(id, entry)) {
      entry.image?.delete()
      return null
    }
    this.rememberLevelEntry(id, entry)
    return entry
  }

  markStale(contentGeneration: number): void {
    for (const entry of this.entries.values()) {
      if (entry.contentGeneration >= contentGeneration)
        entry.contentGeneration = contentGeneration - 1
    }
  }

  invalidateBounds(pageId: string, bounds: TileWorldBounds, contentGeneration: number): number {
    let invalidated = 0
    for (const [id, entry] of this.entries) {
      if (entry.key.pageId !== pageId) continue
      const size = tileWorldSize(entry.key.level)
      const minX = entry.key.x * size
      const minY = entry.key.y * size
      if (
        minX >= bounds.maxX ||
        minY >= bounds.maxY ||
        minX + size <= bounds.minX ||
        minY + size <= bounds.minY
      ) {
        entry.contentGeneration = contentGeneration
        continue
      }
      this.entries.delete(id)
      invalidated++
    }
    return invalidated
  }

  advanceGeneration(contentGeneration: number): void {
    for (const entry of this.entries.values()) entry.contentGeneration = contentGeneration
  }

  clear(): void {
    this.entries.clear()
  }

  size(): number {
    return this.entries.size
  }

  byteSize(): number {
    return this.entries.weight
  }
}
