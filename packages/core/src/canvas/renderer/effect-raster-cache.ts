import type { Image as CKImage } from 'canvaskit-wasm'

import { ResourceCache } from '#core/cache/resource'

export interface EffectRasterCacheEntry {
  image: CKImage
  left: number
  top: number
  width: number
  height: number
  scale: number
  pixels: number
  fontGeneration: number
  dependencyIds: readonly string[]
}

const MAX_EFFECT_RASTER_CACHE_PIXELS = 24_000_000
const MAX_EFFECT_RASTER_ENTRY_PIXELS = 1_000_000
const MIN_EFFECT_RASTER_SCALE = 1
const MAX_EFFECT_RASTER_SCALE = 4
const EFFECT_RASTER_SCALE_STEP = 0.25
const MIN_REUSABLE_SCALE_RATIO = 0.85
const MAX_REUSABLE_SCALE_RATIO = 1.25

export class EffectRasterCache extends ResourceCache<string, EffectRasterCacheEntry> {
  constructor(maxPixels = MAX_EFFECT_RASTER_CACHE_PIXELS) {
    super({
      maxWeight: maxPixels,
      weight: (entry) => entry.pixels,
      dispose: (entry) => entry.image.delete()
    })
  }

  deleteDependencies(nodeId: string): void {
    for (const [ownerId, entry] of this) {
      if (entry.dependencyIds.includes(nodeId)) this.delete(ownerId)
    }
  }
}

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
