/**
 * A read-only view of a map whose values are turned into something else as they are read, such
 * as record headers into whole records. Reading by key decodes one value; iterating values
 * decodes every one, so readers look values up by key.
 */
export class DecodedMap<K, V, W> implements ReadonlyMap<K, W> {
  constructor(
    private readonly source: ReadonlyMap<K, V>,
    private readonly decode: (value: V) => W
  ) {}

  get size(): number {
    return this.source.size
  }

  get(key: K): W | undefined {
    const value = this.source.get(key)
    return value === undefined ? undefined : this.decode(value)
  }

  has(key: K): boolean {
    return this.source.has(key)
  }

  keys(): MapIterator<K> {
    return this.source.keys()
  }

  *values(): MapIterator<W> {
    for (const value of this.source.values()) yield this.decode(value)
  }

  *entries(): MapIterator<[K, W]> {
    for (const [key, value] of this.source) yield [key, this.decode(value)]
  }

  forEach(callback: (value: W, key: K, map: ReadonlyMap<K, W>) => void): void {
    for (const [key, value] of this.entries()) callback(value, key, this)
  }

  [Symbol.iterator](): MapIterator<[K, W]> {
    return this.entries()
  }
}
