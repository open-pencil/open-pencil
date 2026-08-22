import { describe, expect, mock, test } from 'bun:test'

import type { Image as CKImage } from 'canvaskit-wasm'

import { TileImageCache, type RenderedTile } from '#core/canvas/renderer/tiles'

function tile(x: number): RenderedTile {
  const image: Pick<CKImage, 'width' | 'height' | 'delete'> = {
    width: () => 256,
    height: () => 256,
    delete: mock()
  }
  return {
    key: { pageId: 'page', level: 1, x, y: 0 },
    image,
    chunkCount: 1,
    estimatedCost: 1,
    renderMs: 1,
    allocationMs: 0,
    drawMs: 1,
    flushMs: 0,
    snapshotMs: 0
  }
}

describe('tile image cache', () => {
  test('replaces native images and reports memory', () => {
    const cache = new TileImageCache()
    const first = tile(0)
    const second = tile(0)
    cache.install(first, 1)
    cache.install(second, 2)

    expect(first.image.delete).toHaveBeenCalledTimes(1)
    expect(cache.size()).toBe(1)
    expect(cache.byteSize()).toBe(256 * 256 * 4)
    cache.clear()
    expect(second.image.delete).toHaveBeenCalledTimes(1)
  })

  test('invalidates intersecting tiles and advances unaffected generations', () => {
    const cache = new TileImageCache()
    const first = tile(0)
    const second = tile(1)
    cache.install(first, 1)
    cache.install(second, 1)

    expect(cache.invalidateBounds('page', { minX: 300, minY: 10, maxX: 340, maxY: 40 }, 2)).toBe(1)
    expect(cache.get(first.key)?.contentGeneration).toBe(2)
    expect(cache.get(second.key)).toBeNull()
    expect(second.image.delete).toHaveBeenCalledTimes(1)
    cache.clear()
  })

  test('evicts least recently used tiles within its byte budget', () => {
    const bytes = 256 * 256 * 4
    const cache = new TileImageCache(bytes * 2)
    const first = tile(0)
    const second = tile(1)
    const third = tile(2)
    cache.install(first, 1)
    cache.install(second, 1)
    cache.get(first.key)
    cache.install(third, 1)

    expect(second.image.delete).toHaveBeenCalledTimes(1)
    expect(cache.get(first.key)).not.toBeNull()
    expect(cache.get(third.key)).not.toBeNull()
    cache.clear()
  })
})
