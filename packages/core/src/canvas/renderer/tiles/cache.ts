import type { Image as CKImage } from 'canvaskit-wasm'

import { ResourceCache } from '#core/cache/resource'

import { tileKeyString, tileWorldSize, type TileKey, type TileWorldBounds } from './geometry'
import type { RenderedTile } from './render'

export interface CachedTile {
  key: TileKey
  image: CKImage
  contentGeneration: number
  lastUsed: number
  bytes: number
}

const DEFAULT_MAX_TILE_BYTES = 128 * 1024 * 1024

export class TileImageCache {
  private readonly entries: ResourceCache<string, CachedTile>
  private clock = 0

  constructor(maxBytes = DEFAULT_MAX_TILE_BYTES) {
    this.entries = new ResourceCache({
      maxWeight: maxBytes,
      weight: (entry) => entry.bytes,
      dispose: (entry) => entry.image.delete()
    })
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
      bytes: tile.image.width() * tile.image.height() * 4
    }
    if (!this.entries.set(id, entry)) {
      entry.image.delete()
      return null
    }
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
