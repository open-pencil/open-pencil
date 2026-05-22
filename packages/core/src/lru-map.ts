/**
 * An LRU (Least Recently Used) Map that evicts the oldest entry when capacity
 * is exceeded. Uses standard Map insertion-order for recency tracking:
 * delete + re-set on access promotes an entry to most-recent.
 *
 * Designed for Skia resource caches (SkPicture, ImageFilter, MaskFilter)
 * where evicted entries must have .delete() called to free native memory.
 * The `.delete()` call is duck-typed — values without a delete method are
 * silently ignored.
 */
export class LRUMap<K, V> {
  private readonly map = new Map<K, V>()

  constructor(
    /** Maximum entries before eviction */
    public readonly capacity: number
  ) {}

  get size(): number {
    return this.map.size
  }

  get(key: K): V | undefined {
    const value = this.map.get(key)
    if (value !== undefined) {
      // Promote to most-recently used
      this.map.delete(key)
      this.map.set(key, value)
    }
    return value
  }

  set(key: K, value: V): void {
    // Remove existing entry to re-insert at end (most-recent)
    // Must destroy the old value to free native memory
    if (this.map.has(key)) {
      const oldValue = this.map.get(key)
      this.map.delete(key)
      if (oldValue !== value) {
        this.destroyValue(oldValue)
      }
    }
    this.map.set(key, value)

    // Evict oldest entries if over capacity
    while (this.map.size > this.capacity) {
      const oldest = this.map.keys().next()
      if (oldest.done) break
      const oldestKey = oldest.value
      const oldestValue = this.map.get(oldestKey)
      this.map.delete(oldestKey)
      this.destroyValue(oldestValue)
    }
  }

  has(key: K): boolean {
    return this.map.has(key)
  }

  delete(key: K): void {
    const value = this.map.get(key)
    if (value !== undefined) {
      this.map.delete(key)
      this.destroyValue(value)
    }
  }

  /** Iterate values without promoting (for bulk operations like clear) */
  values(): IterableIterator<V> {
    return this.map.values()
  }

  clear(): void {
    for (const value of this.map.values()) {
      this.destroyValue(value)
    }
    this.map.clear()
  }

  keys(): IterableIterator<K> {
    return this.map.keys()
  }

  entries(): IterableIterator<[K, V]> {
    return this.map.entries()
  }

  forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void): void {
    this.map.forEach(callbackfn)
  }

  /** Duck-typed .delete() call — safe for any value type, including arrays of deletable objects */
  private destroyValue(value: V | undefined): void {
    if (value == null) return
    if (isDeletable(value)) {
      value.delete()
    }
    // Handle arrays of deletable objects (e.g. Path[])
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isDeletable(item)) {
          item.delete()
        }
      }
    }
  }
}

/** WASM-cleanup contract: an object with a `delete()` method freeing native resources */
interface Deletable {
  delete(): void
}

/** Type guard: checks whether an unknown value satisfies the Deletable contract */
function isDeletable(value: unknown): value is Deletable {
  return (
    value != null &&
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>).delete === 'function'
  )
}
