import type { Image as CKImage } from 'canvaskit-wasm'

export interface EffectRasterCacheEntry {
  image: CKImage
  left: number
  top: number
  width: number
  height: number
  scale: number
  pixels: number
  fontGeneration: number
}

const MAX_EFFECT_RASTER_CACHE_PIXELS = 24_000_000
const MAX_EFFECT_RASTER_ENTRY_PIXELS = 1_000_000
const MIN_EFFECT_RASTER_SCALE = 1
const MAX_EFFECT_RASTER_SCALE = 4
const EFFECT_RASTER_SCALE_STEP = 0.25
const MIN_REUSABLE_SCALE_RATIO = 0.85
const MAX_REUSABLE_SCALE_RATIO = 1.25

export function effectRasterScale(targetScale: number): number {
  const quantized = Math.ceil(targetScale / EFFECT_RASTER_SCALE_STEP) * EFFECT_RASTER_SCALE_STEP
  return Math.min(MAX_EFFECT_RASTER_SCALE, Math.max(MIN_EFFECT_RASTER_SCALE, quantized))
}

export function effectRasterScaleMatches(cachedScale: number, targetScale: number): boolean {
  const ratio = cachedScale / targetScale
  return ratio >= MIN_REUSABLE_SCALE_RATIO && ratio <= MAX_REUSABLE_SCALE_RATIO
}

export function canCacheEffectRaster(width: number, height: number, scale: number): boolean {
  return (
    width > 0 &&
    height > 0 &&
    Math.ceil(width * scale) * Math.ceil(height * scale) <= MAX_EFFECT_RASTER_ENTRY_PIXELS
  )
}

export function installEffectRaster(
  cache: Map<string, EffectRasterCacheEntry>,
  nodeId: string,
  entry: EffectRasterCacheEntry
): void {
  const previous = cache.get(nodeId)
  previous?.image.delete()
  cache.delete(nodeId)
  cache.set(nodeId, entry)

  let pixels = 0
  for (const value of cache.values()) pixels += value.pixels
  while (pixels > MAX_EFFECT_RASTER_CACHE_PIXELS) {
    const oldest = cache.entries().next().value
    if (!oldest) break
    const [oldestId, oldestEntry] = oldest
    cache.delete(oldestId)
    oldestEntry.image.delete()
    pixels -= oldestEntry.pixels
  }
}

export function touchEffectRaster(
  cache: Map<string, EffectRasterCacheEntry>,
  nodeId: string
): EffectRasterCacheEntry | null {
  const entry = cache.get(nodeId)
  if (!entry) return null
  cache.delete(nodeId)
  cache.set(nodeId, entry)
  return entry
}

export function deleteEffectRaster(
  cache: Map<string, EffectRasterCacheEntry>,
  nodeId: string
): void {
  const entry = cache.get(nodeId)
  entry?.image.delete()
  cache.delete(nodeId)
}

export function clearEffectRasterCache(cache: Map<string, EffectRasterCacheEntry>): void {
  for (const entry of cache.values()) entry.image.delete()
  cache.clear()
}
