import { describe, test, expect } from 'bun:test'

import { LRUMap } from '#core/lru-map'

/**
 * Comprehensive LRUMap tests. These should PASS — LRUMap is well-implemented.
 * These establish the correctness baseline before any optimization.
 */
describe('LRUMap eviction', () => {
  test('evicts oldest entry when capacity is exceeded', () => {
    const map = new LRUMap<string, number>(2)
    map.set('a', 1)
    map.set('b', 2)
    map.set('c', 3) // 'a' should be evicted

    expect(map.get('a')).toBeUndefined()
    expect(map.get('b')).toBe(2)
    expect(map.get('c')).toBe(3)
    expect(map.size).toBe(2)
  })

  test('calls .delete() on evicted Skia-like objects', () => {
    const deleted: string[] = []
    const map = new LRUMap<string, { delete(): void }>(2)
    const makeObj = (name: string) => ({
      delete() {
        deleted.push(name)
      }
    })

    map.set('a', makeObj('obj-a'))
    map.set('b', makeObj('obj-b'))
    map.set('c', makeObj('obj-c')) // evicts 'a'

    expect(deleted).toEqual(['obj-a'])
  })

  test('evicts multiple entries when capacity is exceeded by batch', () => {
    const deleted: string[] = []
    const map = new LRUMap<string, { delete(): void }>(3)
    const makeObj = (name: string) => ({
      delete() {
        deleted.push(name)
      }
    })

    map.set('a', makeObj('a'))
    map.set('b', makeObj('b'))
    map.set('c', makeObj('c'))
    map.set('d', makeObj('d'))
    map.set('e', makeObj('e'))

    // capacity is 3, so a and b should be evicted
    expect(deleted).toEqual(['a', 'b'])
    expect(map.size).toBe(3)
  })
})

describe('LRUMap get() promotion', () => {
  test('get() promotes entry to most-recent, preventing eviction', () => {
    const map = new LRUMap<string, number>(2)
    map.set('a', 1)
    map.set('b', 2)
    // Access 'a' to promote it
    expect(map.get('a')).toBe(1)
    // Now 'b' is the oldest
    map.set('c', 3) // should evict 'b', not 'a'

    expect(map.get('a')).toBe(1)
    expect(map.get('b')).toBeUndefined()
    expect(map.get('c')).toBe(3)
  })

  test('get() returns undefined for missing keys', () => {
    const map = new LRUMap<string, number>(10)
    expect(map.get('missing')).toBeUndefined()
  })
})

describe('LRUMap set() replacement', () => {
  test('set() with same key replaces value and destroys old', () => {
    const deleted: string[] = []
    const map = new LRUMap<string, { delete(): void }>(10)
    const makeObj = (name: string) => ({
      delete() {
        deleted.push(name)
      }
    })

    map.set('a', makeObj('old-a'))
    map.set('a', makeObj('new-a'))

    expect(deleted).toEqual(['old-a'])
    // The new value should be stored
    const val = map.get('a')
    expect(val).toBeDefined()
  })

  test('set() same key with same value does NOT destroy', () => {
    const deleted: string[] = []
    const map = new LRUMap<string, { delete(): void }>(10)
    const obj = {
      delete() {
        deleted.push('destroyed')
      }
    }

    map.set('a', obj)
    map.set('a', obj) // same reference

    expect(deleted).toEqual([])
  })
})

describe('LRUMap clear()', () => {
  test('clear() destroys all values', () => {
    const deleted: string[] = []
    const map = new LRUMap<string, { delete(): void }>(10)
    const makeObj = (name: string) => ({
      delete() {
        deleted.push(name)
      }
    })

    map.set('a', makeObj('a'))
    map.set('b', makeObj('b'))
    map.set('c', makeObj('c'))
    map.clear()

    expect(deleted).toEqual(['a', 'b', 'c'])
    expect(map.size).toBe(0)
  })
})

describe('LRUMap null values', () => {
  test('null values are stored and skipped during destroyValue', () => {
    const deleted: string[] = []
    const map = new LRUMap<string, { delete(): void } | null>(10)
    const makeObj = (name: string) => ({
      delete() {
        deleted.push(name)
      }
    })

    map.set('a', makeObj('a'))
    map.set('b', null)
    map.set('c', makeObj('c'))
    map.clear()

    // null should not cause any .delete() call
    expect(deleted).toEqual(['a', 'c'])
    expect(map.size).toBe(0)
  })

  test('null value replaced by non-null destroys the new value on eviction', () => {
    const deleted: string[] = []
    const map = new LRUMap<string, { delete(): void } | null>(10)
    const makeObj = (name: string) => ({
      delete() {
        deleted.push(name)
      }
    })

    map.set('a', null)
    map.set('a', makeObj('new-a'))

    // Replacing null with a real object: the old value is null,
    // destroyValue(null) should be a no-op.
    // Then clearing should destroy 'new-a'.
    map.clear()
    expect(deleted).toEqual(['new-a'])
  })
})

describe('LRUMap arrays of deletable objects', () => {
  test('arrays have each item .delete() called', () => {
    const deleted: string[] = []
    const map = new LRUMap<string, { delete(): void }[]>(10)
    const makeObj = (name: string) => ({
      delete() {
        deleted.push(name)
      }
    })

    map.set('paths', [makeObj('p1'), makeObj('p2'), makeObj('p3')])
    map.clear()

    expect(deleted).toEqual(['p1', 'p2', 'p3'])
  })

  test('arrays with null items skip nulls during deletion', () => {
    const deleted: string[] = []
    const map = new LRUMap<string, ({ delete(): void } | null)[]>(10)
    const makeObj = (name: string) => ({
      delete() {
        deleted.push(name)
      }
    })

    map.set('paths', [makeObj('p1'), null, makeObj('p3')])
    map.clear()

    expect(deleted).toEqual(['p1', 'p3'])
  })
})

describe('LRUMap objects without .delete()', () => {
  test('plain objects without .delete() are silently ignored during eviction', () => {
    const map = new LRUMap<string, { value: number }>(2)
    map.set('a', { value: 1 })
    map.set('b', { value: 2 })
    // This should NOT throw
    map.set('c', { value: 3 })

    expect(map.get('a')).toBeUndefined()
    expect(map.size).toBe(2)
  })

  test('primitive values are stored and silently ignored during eviction', () => {
    const map = new LRUMap<string, number>(2)
    map.set('a', 1)
    map.set('b', 2)
    // This should NOT throw even though numbers don't have .delete()
    map.set('c', 3)

    expect(map.get('a')).toBeUndefined()
    expect(map.get('b')).toBe(2)
    expect(map.get('c')).toBe(3)
  })
})

describe('LRUMap delete()', () => {
  test('delete() removes entry and destroys value', () => {
    const deleted: string[] = []
    const map = new LRUMap<string, { delete(): void }>(10)
    const makeObj = (name: string) => ({
      delete() {
        deleted.push(name)
      }
    })

    map.set('a', makeObj('a'))
    map.set('b', makeObj('b'))
    map.delete('a')

    expect(deleted).toEqual(['a'])
    expect(map.get('a')).toBeUndefined()
    expect(map.size).toBe(1)
  })

  test('delete() on non-existent key is a no-op', () => {
    const map = new LRUMap<string, number>(10)
    // Should not throw
    map.delete('nonexistent')
    expect(map.size).toBe(0)
  })
})

describe('LRUMap capacity edge case', () => {
  test('capacity=0 immediately evicts every entry', () => {
    const deleted: string[] = []
    const map = new LRUMap<string, { delete(): void }>(0)
    const makeObj = (name: string) => ({
      delete() {
        deleted.push(name)
      }
    })

    map.set('a', makeObj('a'))
    // capacity=0, so 'a' should be evicted immediately
    expect(map.get('a')).toBeUndefined()
    expect(deleted).toEqual(['a'])
  })
})

describe('LRUMap forEach', () => {
  test('forEach iterates in insertion order', () => {
    const map = new LRUMap<string, number>(10)
    map.set('a', 1)
    map.set('b', 2)
    map.set('c', 3)

    const entries: [string, number][] = []
    map.forEach((value, key) => {
      entries.push([key, value])
    })

    expect(entries).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3]
    ])
  })
})

describe('LRUMap has()', () => {
  test('has() returns true for existing keys, false for missing', () => {
    const map = new LRUMap<string, number>(10)
    map.set('a', 1)
    expect(map.has('a')).toBe(true)
    expect(map.has('b')).toBe(false)
  })
})

describe('LRUMap keys() and values()', () => {
  test('keys() returns insertion-order keys', () => {
    const map = new LRUMap<string, number>(10)
    map.set('a', 1)
    map.set('b', 2)
    map.set('c', 3)

    expect([...map.keys()]).toEqual(['a', 'b', 'c'])
  })

  test('values() returns insertion-order values without promotion', () => {
    const map = new LRUMap<string, number>(10)
    map.set('a', 1)
    map.set('b', 2)
    map.set('c', 3)

    expect([...map.values()]).toEqual([1, 2, 3])
  })
})

describe('LRUMap shader-cache bucket pattern', () => {
  test('mutating an existing array and re-setting same reference does NOT destroy it', () => {
    // This verifies the LRUMap behavior that the shader cache relies on:
    // pushing to an existing bucket array and re-setting the same reference
    // does NOT trigger destroyValue (because oldValue === value).
    const deleted: string[] = []
    const map = new LRUMap<number, { delete(): void }[]>(3)
    const makeObj = (name: string) => ({
      delete() {
        deleted.push(name)
      }
    })

    const bucket = [makeObj('a'), makeObj('b')]
    map.set(1, bucket)

    // Mutate the bucket in-place (same pattern as shader cache)
    bucket.push(makeObj('c'))
    map.set(1, bucket) // same reference → destroyValue should NOT be called

    expect(deleted).toEqual([])
    const bucketResult = map.get(1)
    expect(bucketResult).toBeDefined()
    if (bucketResult) expect(bucketResult.length).toBe(3)

    // But clearing the map should destroy ALL items in the bucket
    map.clear()
    expect(deleted).toEqual(['a', 'b', 'c'])
  })

  test('evicting a key with a bucket array destroys all items in the bucket', () => {
    const deleted: string[] = []
    const map = new LRUMap<number, { delete(): void }[]>(2)
    const makeObj = (name: string) => ({
      delete() {
        deleted.push(name)
      }
    })

    const bucket1 = [makeObj('a'), makeObj('b')]
    map.set(1, bucket1)

    const bucket2 = [makeObj('c')]
    map.set(2, bucket2)

    // Adding a third key should evict key 1 and destroy its entire bucket
    map.set(3, [makeObj('d')])

    expect(deleted).toEqual(['a', 'b'])
    expect(map.get(1)).toBeUndefined()
  })
})
