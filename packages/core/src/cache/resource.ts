export type CacheRemovalReason = 'evict' | 'replace' | 'delete' | 'clear'

export interface ResourceCacheOptions<K, V> {
  maxEntries?: number
  maxWeight?: number
  weight?: (value: V, key: K) => number
  dispose?: (value: V, key: K, reason: CacheRemovalReason) => void
}

interface Slot<K, V> {
  key: K
  value: V
  weight: number
  previous: number
  next: number
}

interface Removal<K, V> {
  slot: Slot<K, V>
  reason: CacheRemovalReason
}

/**
 * Bounded, owning LRU storage. Hits update numeric links, not Map insertion order.
 * Non-negative safe-integer weights are captured on insertion; domains own sizing and validity.
 * Disposed values must not share owned native handles across keys.
 * A successful set transfers ownership. A rejected set leaves ownership with the caller.
 * Returned values are borrowed until removal. Iteration does not touch recency.
 */
export class ResourceCache<K, V> {
  private readonly index = new Map<K, number>()
  private slots: Array<Slot<K, V> | undefined> = []
  private free: number[] = []
  private oldest = -1
  private newest = -1
  private totalWeight = 0
  private readonly maxEntries: number
  private readonly maxWeight: number

  constructor(private readonly options: ResourceCacheOptions<K, V>) {
    this.maxEntries = options.maxEntries ?? Infinity
    const maxWeight = options.maxWeight ?? Infinity
    this.maxWeight = Math.min(maxWeight, Number.MAX_SAFE_INTEGER)
    if (
      !(
        this.maxEntries === Infinity ||
        (Number.isSafeInteger(this.maxEntries) && this.maxEntries >= 0)
      ) ||
      !(maxWeight === Infinity || (Number.isSafeInteger(maxWeight) && maxWeight >= 0)) ||
      (this.maxEntries === Infinity && maxWeight === Infinity)
    )
      throw new RangeError('ResourceCache requires a finite non-negative count or weight budget')
  }

  get size(): number {
    return this.index.size
  }
  get weight(): number {
    return this.totalWeight
  }

  has(key: K): boolean {
    return this.index.has(key)
  }

  peek(key: K): V | undefined {
    const index = this.index.get(key)
    return index === undefined ? undefined : this.slot(index).value
  }

  get(key: K): V | undefined {
    const index = this.index.get(key)
    if (index === undefined) return undefined
    const slot = this.slot(index)
    if (index !== this.newest) {
      this.unlink(slot)
      this.append(index, slot)
    }
    return slot.value
  }

  set(key: K, value: V): boolean {
    const weight = this.options.weight?.(value, key) ?? 1
    if (
      !Number.isSafeInteger(weight) ||
      weight < 0 ||
      (weight === 0 && this.maxEntries === Infinity)
    ) {
      throw new RangeError(
        'ResourceCache requires safe-integer weights and a finite entry limit for zero weights'
      )
    }
    if (this.maxEntries === 0 || weight > this.maxWeight) return false

    const removed: Removal<K, V>[] = []
    const existing = this.index.get(key)
    if (existing !== undefined) {
      const old = this.remove(existing)
      if (old.value !== value) removed.push({ slot: old, reason: 'replace' })
    }
    // Evict before addition so accounting never exceeds the safe-integer range.
    while (this.size >= this.maxEntries || weight > this.maxWeight - this.totalWeight) {
      removed.push({ slot: this.remove(this.oldest), reason: 'evict' })
    }
    const index = this.free.pop() ?? this.slots.length
    const slot: Slot<K, V> = { key, value, weight, previous: -1, next: -1 }
    this.slots[index] = slot
    this.index.set(key, index)
    this.totalWeight += weight
    this.append(index, slot)
    this.dispose(removed)
    return true
  }

  delete(key: K): boolean {
    const index = this.index.get(key)
    if (index === undefined) return false
    const slot = this.remove(index)
    this.options.dispose?.(slot.value, slot.key, 'delete')
    return true
  }

  clear(): void {
    const slots = this.slots
    this.index.clear()
    this.slots = []
    this.free = []
    this.oldest = this.newest = -1
    this.totalWeight = 0
    this.dispose(slots.flatMap((slot) => (slot ? [{ slot, reason: 'clear' as const }] : [])))
  }

  *entries(): IterableIterator<[K, V]> {
    for (const [key, index] of this.index) yield [key, this.slot(index).value]
  }

  *values(): IterableIterator<V> {
    for (const index of this.index.values()) yield this.slot(index).value
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.entries()
  }

  private slot(index: number): Slot<K, V> {
    const slot = this.slots[index]
    if (!slot) throw new Error('Invalid ResourceCache link')
    return slot
  }

  private unlink(slot: Slot<K, V>): void {
    if (slot.previous === -1) this.oldest = slot.next
    else this.slot(slot.previous).next = slot.next
    if (slot.next === -1) this.newest = slot.previous
    else this.slot(slot.next).previous = slot.previous
  }

  private append(index: number, slot: Slot<K, V>): void {
    slot.previous = this.newest
    slot.next = -1
    if (this.newest === -1) this.oldest = index
    else this.slot(this.newest).next = index
    this.newest = index
  }

  private remove(index: number): Slot<K, V> {
    const slot = this.slot(index)
    this.unlink(slot)
    this.index.delete(slot.key)
    this.slots[index] = undefined
    this.free.push(index)
    this.totalWeight -= slot.weight
    if (this.index.size === 0) this.totalWeight = 0
    return slot
  }

  private dispose(removed: Removal<K, V>[]): void {
    let errors: unknown[] | undefined
    for (const { slot, reason } of removed) {
      try {
        this.options.dispose?.(slot.value, slot.key, reason)
      } catch (error) {
        ;(errors ??= []).push(error)
      }
    }
    if (errors) throw new AggregateError(errors, 'ResourceCache cleanup failed')
  }
}
