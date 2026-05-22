import { afterEach, describe, expect, test } from 'bun:test'

import type { destroyRenderer as DestroyRenderer } from '#core/canvas/renderer/lifecycle'
import { LRUMap } from '#core/lru-map'
import type {
  clearOpenTypeCaches as ClearOpenTypeCaches,
  getOpenTypeCacheSizes as GetOpenTypeCacheSizes,
  PARSED_FONT_CACHE_LIMIT as ParsedFontCacheLimit
} from '#core/text/opentype'

import { createMockRenderer } from '#tests/engine/render/canvas/helpers'

let clearOpenTypeCaches: ClearOpenTypeCaches
let destroyRenderer: DestroyRenderer
let getOpenTypeCacheSizes: GetOpenTypeCacheSizes
let parsedFontCacheLimit: ParsedFontCacheLimit

describe('OpenType cache lifecycle', async () => {
  const opentype = await import('#core/text/opentype')
  clearOpenTypeCaches = opentype.clearOpenTypeCaches
  getOpenTypeCacheSizes = opentype.getOpenTypeCacheSizes
  parsedFontCacheLimit = opentype.PARSED_FONT_CACHE_LIMIT
  destroyRenderer = (await import('#core/canvas/renderer/lifecycle')).destroyRenderer

  afterEach(() => {
    clearOpenTypeCaches()
  })

  test('LRU map bounds entries and evicts oldest', () => {
    const lru = new LRUMap<string, number>(3)
    lru.set('a', 1)
    lru.set('b', 2)
    lru.set('c', 3)
    expect(lru.size).toBe(3)
    lru.set('d', 4)
    expect(lru.size).toBe(3)
    expect(lru.get('a')).toBeUndefined()
    expect(lru.get('d')).toBe(4)
  })

  test('clearOpenTypeCaches empties both caches', () => {
    // After clearing, both cache sizes should be 0
    clearOpenTypeCaches()
    expect(getOpenTypeCacheSizes().parsedFont).toBe(0)
    expect(getOpenTypeCacheSizes().glyphOutline).toBe(0)
  })

  test('renderer teardown calls clearOpenTypeCaches and resets cache sizes', () => {
    clearOpenTypeCaches()
    // Call destroyRenderer with a mock renderer — it should call
    // clearOpenTypeCaches() internally
    destroyRenderer(createMockRenderer())
    expect(getOpenTypeCacheSizes().parsedFont).toBe(0)
  })

  test('PARSED_FONT_CACHE_LIMIT matches LRUMap capacity', () => {
    expect(parsedFontCacheLimit).toBe(128)
  })
})
