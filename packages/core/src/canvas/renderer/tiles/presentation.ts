import type { Canvas, FilterMode } from 'canvaskit-wasm'

import type { SkiaRenderer } from '#core/canvas/renderer'

import type { CachedTile, TileImageCache } from './cache'
import { TILE_DEVICE_SIZE, type TileKey, tileWorldBounds, type TileWorldBounds } from './geometry'

export interface VisiblePresentation {
  exact: Array<{ key: TileKey; tile: CachedTile }>
  fallback: Array<{ key: TileKey; tiles: CachedTile[] }>
  uncovered: number
  uncoveredContent: number
}

/**
 * Sorts the visible tiles into those the cache has at the level, those another level stands in
 * for, and areas no level covers, counting the uncovered ones that lie over the page's content.
 */
export function resolveVisible(
  cache: TileImageCache,
  visible: Array<{ key: TileKey; tile: CachedTile | null }>,
  pageId: string,
  level: number,
  content: TileWorldBounds | null
): VisiblePresentation {
  const presentation: VisiblePresentation = {
    exact: [],
    fallback: [],
    uncovered: 0,
    uncoveredContent: 0
  }
  let levels: number[] | undefined
  for (const { key, tile } of visible) {
    if (tile) {
      presentation.exact.push({ key, tile })
      continue
    }
    levels ??= cache.fallbackLevels(pageId, level)
    const tiles = cache.findFallback(key, levels, content)
    if (tiles) {
      presentation.fallback.push({ key, tiles })
      continue
    }
    presentation.uncovered++
    const bounds = tileWorldBounds(key)
    if (
      content &&
      bounds.minX < content.maxX &&
      bounds.maxX > content.minX &&
      bounds.minY < content.maxY &&
      bounds.maxY > content.minY
    ) {
      presentation.uncoveredContent++
    }
  }
  return presentation
}

/** Draws tiles in world space; the canvas already carries the viewport transform. */
export function drawPresentation(
  renderer: SkiaRenderer,
  canvas: Canvas,
  presentation: VisiblePresentation
): void {
  const paint = renderer.opacityPaint
  paint.setAlphaf(1)
  paint.setBlendMode(renderer.ck.BlendMode.Src)
  const source = renderer.ck.LTRBRect(0, 0, TILE_DEVICE_SIZE, TILE_DEVICE_SIZE)
  const drawTile = (tile: CachedTile, filter: FilterMode) => {
    if (!tile.image) return
    const bounds = tileWorldBounds(tile.key)
    canvas.drawImageRectOptions(
      tile.image,
      source,
      renderer.ck.LTRBRect(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY),
      filter,
      renderer.ck.MipmapMode.None,
      paint
    )
  }
  try {
    for (const { tiles, key } of presentation.fallback) {
      const bounds = tileWorldBounds(key)
      canvas.save()
      canvas.clipRect(
        renderer.ck.LTRBRect(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY),
        renderer.ck.ClipOp.Intersect,
        false
      )
      for (const tile of tiles) drawTile(tile, renderer.ck.FilterMode.Linear)
      canvas.restore()
    }
    // An exact tile sits texel on pixel; nearest sampling copies it, so float noise in the
    // viewport can never shift a value at a seam.
    for (const { tile } of presentation.exact) drawTile(tile, renderer.ck.FilterMode.Nearest)
  } finally {
    paint.setBlendMode(renderer.ck.BlendMode.SrcOver)
  }
}
