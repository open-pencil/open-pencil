import type { Path } from 'canvaskit-wasm'

import { ResourceCache } from '#core/cache/resource'

/**
 * Points one node path cache keeps, about 64 MB of CanvasKit heap. A page of 20,000 icons with 100
 * points each takes half of it; a page larger than the cache rebuilds every path on each recording.
 */
export const PATH_CACHE_POINTS = 4_000_000
export const PATH_CACHE_ENTRIES = 65_536
/** Weight of a path beyond its points, so many tiny paths still count against the budget. */
const PATH_OVERHEAD_POINTS = 8

export interface PathCacheLimits {
  maxPoints?: number
  maxEntries?: number
}

type CachedPaths = Path | Path[]

function pathWeight(value: CachedPaths): number {
  if (!Array.isArray(value)) return value.countPoints() + PATH_OVERHEAD_POINTS
  let weight = 0
  for (const path of value) weight += path.countPoints() + PATH_OVERHEAD_POINTS
  return weight
}

function deletePaths(value: CachedPaths): void {
  if (!Array.isArray(value)) value.delete()
  else for (const path of value) path.delete()
}

/** Owns cached paths, weighed by point count; evicted, replaced, and deleted entries delete them. */
export function createPathCache<K = string, V extends CachedPaths = Path[]>({
  maxPoints = PATH_CACHE_POINTS,
  maxEntries = PATH_CACHE_ENTRIES
}: PathCacheLimits = {}): ResourceCache<K, V> {
  return new ResourceCache<K, V>({
    maxEntries,
    maxWeight: maxPoints,
    weight: pathWeight,
    dispose: deletePaths
  })
}

export type NodePathCache = ResourceCache<string, Path[]>

/**
 * The paths a renderer builds for each node, keyed by node id (stroke outlines by `<nodeId>|…`).
 * Paths a cache rejects as larger than its whole budget stay here until `releaseUncached`, which
 * runs when a frame or an export starts, so callers can draw them now without leaking them.
 */
export class NodePathCaches {
  readonly vector: NodePathCache
  readonly vectorStroke: NodePathCache
  readonly strokeOutline: NodePathCache
  readonly fillGeometry: NodePathCache
  readonly strokeGeometry: NodePathCache
  readonly shared: NodePathCache
  readonly sharedKeys: ResourceCache<string, string>
  private readonly caches: readonly NodePathCache[]
  private uncached: Path[][] = []

  constructor(limits: PathCacheLimits = {}) {
    this.vector = createPathCache(limits)
    this.vectorStroke = createPathCache(limits)
    this.strokeOutline = createPathCache(limits)
    this.fillGeometry = createPathCache(limits)
    this.strokeGeometry = createPathCache(limits)
    this.shared = createPathCache(limits)
    this.sharedKeys = new ResourceCache<string, string>({
      maxEntries: limits.maxEntries ?? PATH_CACHE_ENTRIES
    })
    this.caches = [
      this.vector,
      this.vectorStroke,
      this.strokeOutline,
      this.fillGeometry,
      this.strokeGeometry,
      this.shared
    ]
  }

  /** Stores paths built for drawing; the caller borrows them until the next `releaseUncached`. */
  store(cache: NodePathCache, key: string, paths: Path[]): void {
    if (!cache.set(key, paths)) this.uncached.push(paths)
  }

  /** Deletes every path built for a node. */
  invalidate(nodeId: string): void {
    for (const cache of this.caches) cache.delete(nodeId)
    const outlinePrefix = `${nodeId}|`
    this.strokeOutline.deleteWhere((_, key) => key.startsWith(outlinePrefix))
    this.sharedKeys.deleteWhere((_, key) => key.startsWith(outlinePrefix))
  }

  /** Deletes the paths `store` could not cache. */
  releaseUncached(): void {
    const uncached = this.uncached
    if (uncached.length === 0) return
    this.uncached = []
    for (const paths of uncached) deletePaths(paths)
  }

  clear(): void {
    for (const cache of this.caches) cache.clear()
    this.sharedKeys.clear()
    this.releaseUncached()
  }
}
