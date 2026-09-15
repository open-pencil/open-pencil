import { describe, expect, test } from 'bun:test'

import { ResourceCache, type CacheRemovalReason } from '#core/cache/resource'

interface Resource {
  id: number
  units: number
}

describe('ResourceCache', () => {
  test('touches hits but not peeks or iteration, and disposes every removal', () => {
    const removed: Array<[number, CacheRemovalReason]> = []
    const cache = new ResourceCache<string, Resource>({
      maxEntries: 2,
      dispose: (value, _, reason) => removed.push([value.id, reason])
    })
    const first = { id: 1, units: 1 }
    cache.set('a', first)
    cache.set('b', { id: 2, units: 1 })
    expect(cache.get('a')).toBe(first)
    cache.peek('b')
    expect([...cache.values()]).toHaveLength(2)
    cache.set('c', { id: 3, units: 1 })
    expect(cache.has('b')).toBe(false)
    cache.set('a', { id: 4, units: 1 })
    expect(cache.delete('c')).toBe(true)
    expect(cache.delete('c')).toBe(false)
    cache.clear()
    expect(removed).toEqual([
      [2, 'evict'],
      [1, 'replace'],
      [3, 'delete'],
      [4, 'clear']
    ])
    expect(cache.size).toBe(0)
    expect(cache.weight).toBe(0)
  })

  test('rejects oversized entries without taking ownership or disturbing the old entry', () => {
    const removed: number[] = []
    const cache = new ResourceCache<string, Resource>({
      maxEntries: 2,
      maxWeight: 10,
      weight: (value) => value.units,
      dispose: (value) => removed.push(value.id)
    })
    const first = { id: 1, units: 6 }
    cache.set('a', first)
    expect(cache.set('a', { id: 2, units: 11 })).toBe(false)
    expect(cache.get('a')).toBe(first)
    expect(removed).toEqual([])
    cache.set('b', { id: 3, units: 5 })
    expect(removed).toEqual([1])
    expect(cache.weight).toBe(5)
    expect(cache.set('empty', { id: 4, units: 0 })).toBe(true)
    expect(cache.size).toBe(2)
  })

  test('reinstalling the same owned value updates accounting without deleting it', () => {
    let removed = 0
    const cache = new ResourceCache<string, Resource>({
      maxEntries: 2,
      maxWeight: 10,
      weight: (value) => value.units,
      dispose: () => {
        removed++
      }
    })
    const value = { id: 1, units: 2 }
    cache.set('a', value)
    value.units = 7
    cache.set('a', value)
    expect(cache.weight).toBe(7)
    expect(removed).toBe(0)
    cache.clear()
    expect(removed).toBe(1)
  })

  test('removal hooks observe completed bookkeeping and may populate an emptied cache', () => {
    let populate = false
    const cache = new ResourceCache<string, number>({
      maxEntries: 2,
      dispose: () => {
        expect(cache.size).toBeLessThanOrEqual(2)
        if (populate) {
          populate = false
          cache.set('new', 3)
        }
      }
    })
    cache.set('a', 1)
    cache.set('b', 2)
    populate = true
    cache.clear()
    expect(cache.get('new')).toBe(3)
    expect(cache.size).toBe(1)
  })

  test('clear continues cleanup after a disposer throws', () => {
    const removed: number[] = []
    const cache = new ResourceCache<string, number>({
      maxEntries: 2,
      dispose: (value) => {
        removed.push(value)
        if (value === 1) throw new Error('cleanup failed')
      }
    })
    cache.set('a', 1)
    cache.set('b', 2)
    expect(() => cache.clear()).toThrow(AggregateError)
    expect(removed).toEqual([1, 2])
    expect(cache.size).toBe(0)
    cache.set('c', 3)
    expect(cache.get('c')).toBe(3)
  })

  test('supports deleting entries during non-touching iteration', () => {
    const cache = new ResourceCache<string, number>({ maxEntries: 8 })
    for (let i = 0; i < 8; i++) cache.set(String(i), i)
    for (const [key, value] of cache) if (value % 2 === 0) cache.delete(key)
    expect([...cache.values()]).toEqual([1, 3, 5, 7])
  })

  test('keeps accounting exact without temporarily overflowing integer precision', () => {
    const cache = new ResourceCache<string, number>({
      maxWeight: Number.MAX_SAFE_INTEGER,
      weight: (value) => value
    })
    cache.set('large', Number.MAX_SAFE_INTEGER - 2)
    cache.set('small', 2)
    cache.set('next', 2)
    expect(cache.weight).toBe(4)
    expect(cache.size).toBe(2)
    expect(cache.peek('next')).toBe(2)
  })

  test('validates budgets and leaves zero-capacity resources with the caller', () => {
    expect(() => new ResourceCache({})).toThrow(RangeError)
    expect(() => new ResourceCache({ maxEntries: -1 })).toThrow(RangeError)
    expect(() => new ResourceCache({ maxEntries: 1.5 })).toThrow(RangeError)
    expect(() => new ResourceCache({ maxWeight: 0.3 })).toThrow(RangeError)
    const disabled = new ResourceCache({ maxEntries: 0 })
    expect(disabled.set('x', 1)).toBe(false)
    const weighted = new ResourceCache<string, number>({ maxWeight: 10, weight: (value) => value })
    expect(() => weighted.set('x', Number.NaN)).toThrow(RangeError)
    expect(() => weighted.set('x', 0.1)).toThrow(RangeError)
    expect(() => weighted.set('x', 0)).toThrow(RangeError)
  })

  for (const maxEntries of [1, 3, 16]) {
    test(`matches a reference LRU over replacements, weighted eviction and slot reuse (${maxEntries})`, () => {
      const actualRemoved: number[] = []
      const expectedRemoved: number[] = []
      const reference = new Map<number, Resource>()
      const cache = new ResourceCache<number, Resource>({
        maxEntries,
        maxWeight: 25,
        weight: (value) => value.units,
        dispose: (value) => actualRemoved.push(value.id)
      })
      for (let i = 0; i < 5000; i++) {
        const key = Math.imul(i + 1, 2654435761) >>> 28
        const operation = i % 17
        if (operation < 10) {
          const value = { id: i, units: (i % 9) + 1 }
          const old = reference.get(key)
          if (old) expectedRemoved.push(old.id)
          reference.delete(key)
          reference.set(key, value)
          while (
            reference.size > maxEntries ||
            [...reference.values()].reduce((sum, value) => sum + value.units, 0) > 25
          ) {
            const oldest = reference.entries().next().value
            if (!oldest) throw new Error('Missing reference entry')
            reference.delete(oldest[0])
            expectedRemoved.push(oldest[1].id)
          }
          cache.set(key, value)
        } else if (operation < 14) {
          const value = reference.get(key)
          if (value) {
            reference.delete(key)
            reference.set(key, value)
          }
          expect(cache.get(key)).toBe(value)
        } else if (operation < 16) {
          const old = reference.get(key)
          if (old) expectedRemoved.push(old.id)
          expect(cache.delete(key)).toBe(reference.delete(key))
        } else {
          expect(cache.peek(key)).toBe(reference.get(key))
        }
        expect(cache.size).toBe(reference.size)
        expect(cache.weight).toBe(
          [...reference.values()].reduce((sum, value) => sum + value.units, 0)
        )
        expect(actualRemoved).toEqual(expectedRemoved)
      }
      cache.clear()
      expect(new Set(actualRemoved).size).toBe(actualRemoved.length)
    })
  }
})
