import { describe, expect, mock, test } from 'bun:test'

import {
  canCacheEffectRaster,
  clearEffectRasterCache,
  deleteEffectRaster,
  effectRasterScale,
  effectRasterScaleMatches,
  installEffectRaster,
  touchEffectRaster,
  type EffectRasterCacheEntry
} from '#core/canvas/renderer/effect-raster-cache'

function entry(pixels: number): EffectRasterCacheEntry {
  return {
    image: { delete: mock(), width: () => 10, height: () => 10 } as never,
    left: 0,
    top: 0,
    width: 10,
    height: 10,
    scale: 2,
    pixels,
    fontGeneration: 0
  }
}

describe('effect raster cache', () => {
  test('quantizes target scale upward and detects replacement boundaries', () => {
    expect(effectRasterScale(1.01)).toBe(1.25)
    expect(effectRasterScale(2)).toBe(2)
    expect(effectRasterScale(10)).toBe(4)
    expect(effectRasterScaleMatches(2, 1.9)).toBe(true)
    expect(effectRasterScaleMatches(2, 2.01)).toBe(true)
    expect(effectRasterScaleMatches(2, 2.5)).toBe(false)
    expect(effectRasterScaleMatches(2, 1.5)).toBe(false)
  })

  test('bounds individual raster allocations', () => {
    expect(canCacheEffectRaster(500, 500, 2)).toBe(true)
    expect(canCacheEffectRaster(501, 500, 2)).toBe(false)
    expect(canCacheEffectRaster(0, 100, 2)).toBe(false)
  })

  test('replaces entries and disposes native images', () => {
    const cache = new Map<string, EffectRasterCacheEntry>()
    const first = entry(100)
    const second = entry(100)
    installEffectRaster(cache, 'node', first)
    installEffectRaster(cache, 'node', second)
    expect(first.image.delete).toHaveBeenCalledTimes(1)
    expect(cache.get('node')).toBe(second)

    deleteEffectRaster(cache, 'node')
    expect(second.image.delete).toHaveBeenCalledTimes(1)
    expect(cache.size).toBe(0)
  })

  test('evicts least-recently-used entries within the pixel budget', () => {
    const cache = new Map<string, EffectRasterCacheEntry>()
    const first = entry(12_000_000)
    const second = entry(8_000_000)
    const third = entry(8_000_000)
    installEffectRaster(cache, 'first', first)
    installEffectRaster(cache, 'second', second)
    expect(touchEffectRaster(cache, 'first')).toBe(first)
    installEffectRaster(cache, 'third', third)

    expect(second.image.delete).toHaveBeenCalledTimes(1)
    expect(cache.has('second')).toBe(false)
    expect(cache.has('first')).toBe(true)
    expect(cache.has('third')).toBe(true)

    clearEffectRasterCache(cache)
    expect(first.image.delete).toHaveBeenCalledTimes(1)
    expect(third.image.delete).toHaveBeenCalledTimes(1)
  })
})
