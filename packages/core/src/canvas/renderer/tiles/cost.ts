import type { TileKey } from './geometry'

const TILE_COST_SMOOTHING = 0.3
/** Tiles whose own time is kept; past this the oldest reading goes, a session never clearing. */
const MAX_MEASURED_TILES = 4096

function smoothCost(previous: number | undefined, costMs: number): number {
  if (previous === undefined) return costMs
  return previous * (1 - TILE_COST_SMOOTHING) + costMs * TILE_COST_SMOOTHING
}

/**
 * Smoothed render times of the tiles rendered so far, in ms, for the scheduler's estimates: a
 * tile rendered before is estimated at its own smoothed time, and one not rendered yet from
 * its chunk count, since a coarse tile over a whole page costs a hundred times one over a
 * corner of it, at the per-chunk time of its own level first, since a chunk clipped to a fine
 * tile costs less than one drawn whole into a coarse one. The scheduler compares estimates with
 * its frame budget, so they must be times, not counts.
 */
export class TileCostModel {
  private readonly measured = new Map<string, number>()
  private readonly perChunkMsByLevel = new Map<number, number>()
  private perChunkMs: number | undefined

  /** The estimated render time of `key`, which has `chunkCount` chunks to draw. */
  estimate(key: TileKey, chunkCount: number): number {
    const measured = this.measured.get(this.id(key))
    if (measured !== undefined) return measured
    const perChunk = this.perChunkMsByLevel.get(key.level) ?? this.perChunkMs ?? 0
    return perChunk * chunkCount
  }

  record(key: TileKey, costMs: number, chunkCount: number): void {
    const id = this.id(key)
    const previous = this.measured.get(id)
    if (previous !== undefined) this.measured.delete(id)
    else if (this.measured.size >= MAX_MEASURED_TILES) {
      const oldest = this.measured.keys().next().value
      if (oldest !== undefined) this.measured.delete(oldest)
    }
    this.measured.set(id, smoothCost(previous, costMs))
    if (chunkCount === 0) return
    const perChunk = costMs / chunkCount
    this.perChunkMsByLevel.set(
      key.level,
      smoothCost(this.perChunkMsByLevel.get(key.level), perChunk)
    )
    this.perChunkMs = smoothCost(this.perChunkMs, perChunk)
  }

  clear(): void {
    this.measured.clear()
    this.perChunkMsByLevel.clear()
    this.perChunkMs = undefined
  }

  private id(key: TileKey): string {
    return `${key.level}:${key.x}:${key.y}`
  }
}
