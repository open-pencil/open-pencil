import type { Image as CKImage } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'
import {
  type RenderChunk,
  type RenderChunkIndex,
  type RenderChunkPictureCache,
  drawRenderChunkDirect
} from '#core/canvas/renderer/chunks'
import { rendererNow } from '#core/canvas/renderer/clock'

import type { CachedTile } from './cache'
import type { TileCostModel } from './cost'
import { TILE_DEVICE_SIZE, type TileKey, tileWorldBounds } from './geometry'
import type { TileJobResult } from './scheduler'
import type { TileSurfacePool } from './surface-pool'

export interface RenderedTile {
  key: TileKey
  /** Null for a tile with nothing in it. */
  image: CKImage | null
  chunkCount: number
  estimatedCost: number
  renderMs: number
  allocationMs: number
  drawMs: number
  flushMs: number
  snapshotMs: number
}

function isBoundedAtomicBlurChunk(graph: SceneGraph, chunk: RenderChunk): boolean {
  if (chunk.interruptible || chunk.kind !== 'subtree') return false
  const node = graph.getNode(chunk.nodeId)
  return (
    node?.effects.some(
      (effect) =>
        effect.visible && (effect.type === 'LAYER_BLUR' || effect.type === 'FOREGROUND_BLUR')
    ) === true
  )
}

export function renderTile(
  renderer: SkiaRenderer,
  graph: SceneGraph,
  index: RenderChunkIndex,
  key: TileKey,
  pictureCache: RenderChunkPictureCache,
  surfacePool: TileSurfacePool
): RenderedTile | null {
  const startedAt = rendererNow()
  const bounds = tileWorldBounds(key)
  const chunks = index.search(bounds)
  if (chunks.length === 0) return emptyTile(key, rendererNow() - startedAt)
  const allocationStartedAt = rendererNow()
  const surface = surfacePool.acquire(renderer)
  if (!surface) return null
  const allocationMs = rendererNow() - allocationStartedAt
  const canvas = surface.getCanvas()
  const previousDetail = renderer.imageDetailScale
  renderer.imageDetailScale = key.level
  canvas.save()
  try {
    canvas.clear(
      renderer.ck.Color4f(
        renderer.pageColor.r,
        renderer.pageColor.g,
        renderer.pageColor.b,
        renderer.pageColor.a
      )
    )
    canvas.scale(key.level, key.level)
    canvas.translate(-bounds.minX, -bounds.minY)
    canvas.clipRect(
      renderer.ck.LTRBRect(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY),
      renderer.ck.ClipOp.Intersect,
      false
    )

    const drawStartedAt = rendererNow()
    for (const chunk of chunks) {
      if (isBoundedAtomicBlurChunk(graph, chunk)) {
        const previous = renderer.boundEffectLayersToViewport
        renderer.boundEffectLayersToViewport = true
        try {
          drawRenderChunkDirect(renderer, canvas, graph, chunk)
        } finally {
          renderer.boundEffectLayersToViewport = previous
        }
        continue
      }
      const picture = pictureCache.get(renderer, graph, chunk)
      canvas.drawPicture(picture)
    }
    const drawMs = rendererNow() - drawStartedAt
    // Each tile is submitted on its own: batched with its neighbours' draws, Skia may rasterize
    // the same glyphs and paths along different routes, and a tile rendered twice must match.
    const flushStartedAt = rendererNow()
    surface.flush()
    const flushMs = rendererNow() - flushStartedAt
    const snapshotStartedAt = rendererNow()
    const image = surface.makeImageSnapshot()
    const snapshotMs = rendererNow() - snapshotStartedAt
    return {
      key,
      image,
      chunkCount: chunks.length,
      estimatedCost: chunks.reduce((total, chunk) => total + chunk.estimatedCost, 0),
      renderMs: rendererNow() - startedAt,
      allocationMs,
      drawMs,
      flushMs,
      snapshotMs
    }
  } finally {
    canvas.restore()
    renderer.imageDetailScale = previousDetail
    surfacePool.release(surface)
  }
}

/** A tile over nothing: it costs no surface and draws as the page colour. */
function emptyTile(key: TileKey, renderMs: number): RenderedTile {
  return {
    key,
    image: null,
    chunkCount: 0,
    estimatedCost: 0,
    renderMs,
    allocationMs: 0,
    drawMs: 0,
    flushMs: 0,
    snapshotMs: 0
  }
}

/** The four tiles twice as fine that make up `key`, in reading order. */
export function childTileKeys(key: TileKey): TileKey[] {
  const level = key.level * 2
  return [0, 1].flatMap((dy) =>
    [0, 1].map((dx) => ({ pageId: key.pageId, level, x: key.x * 2 + dx, y: key.y * 2 + dy }))
  )
}

/**
 * Builds `key`'s tile from its four cached children instead of the scene: each child lands in
 * a quadrant at half size, and linear sampling at exactly twice the scale averages each pixel
 * from the four beneath it. The children are passed in the order of `childTileKeys`.
 */
export function downsampleTile(
  renderer: SkiaRenderer,
  key: TileKey,
  children: ReadonlyArray<CachedTile>,
  surfacePool: TileSurfacePool
): RenderedTile | null {
  const startedAt = rendererNow()
  if (children.every((child) => child.image === null)) {
    return emptyTile(key, rendererNow() - startedAt)
  }
  const allocationStartedAt = rendererNow()
  const surface = surfacePool.acquire(renderer)
  if (!surface) return null
  const allocationMs = rendererNow() - allocationStartedAt
  const canvas = surface.getCanvas()
  const half = TILE_DEVICE_SIZE / 2
  const paint = renderer.opacityPaint
  canvas.save()
  try {
    canvas.clear(
      renderer.ck.Color4f(
        renderer.pageColor.r,
        renderer.pageColor.g,
        renderer.pageColor.b,
        renderer.pageColor.a
      )
    )
    paint.setAlphaf(1)
    paint.setBlendMode(renderer.ck.BlendMode.Src)
    const drawStartedAt = rendererNow()
    children.forEach((child, index) => {
      if (!child.image) return
      const dx = (index % 2) * half
      const dy = Math.floor(index / 2) * half
      canvas.drawImageRectOptions(
        child.image,
        renderer.ck.LTRBRect(0, 0, TILE_DEVICE_SIZE, TILE_DEVICE_SIZE),
        renderer.ck.LTRBRect(dx, dy, dx + half, dy + half),
        renderer.ck.FilterMode.Linear,
        renderer.ck.MipmapMode.None,
        paint
      )
    })
    const drawMs = rendererNow() - drawStartedAt
    const flushStartedAt = rendererNow()
    surface.flush()
    const flushMs = rendererNow() - flushStartedAt
    const snapshotStartedAt = rendererNow()
    const image = surface.makeImageSnapshot()
    const snapshotMs = rendererNow() - snapshotStartedAt
    return {
      key,
      image,
      chunkCount: 0,
      estimatedCost: 0,
      renderMs: rendererNow() - startedAt,
      allocationMs,
      drawMs,
      flushMs,
      snapshotMs
    }
  } finally {
    paint.setBlendMode(renderer.ck.BlendMode.SrcOver)
    canvas.restore()
    surfacePool.release(surface)
  }
}

/** The scheduler's account of a rendered tile: over budget when it alone took longer than one. */
export function tileJobResult(tile: RenderedTile, budgetMs: number): TileJobResult {
  return {
    renderMs: tile.renderMs,
    overBudget: tile.renderMs > budgetMs,
    allocationMs: tile.allocationMs,
    drawMs: tile.drawMs,
    flushMs: tile.flushMs,
    snapshotMs: tile.snapshotMs,
    chunkCount: tile.chunkCount
  }
}

export function deleteRenderedTile(tile: RenderedTile): void {
  tile.image?.delete()
}

export function tileChunks(index: RenderChunkIndex, key: TileKey): RenderChunk[] {
  return index.search(tileWorldBounds(key))
}

/**
 * The estimated time to render `key`: a tile over nothing is free; while moving, a tile with a
 * chunk picture still to record is beyond the frame, since recording cannot be bounded below
 * one chunk; otherwise the cost model's estimate.
 */
export function estimateTileCost(
  renderer: SkiaRenderer,
  index: RenderChunkIndex,
  pictureCache: RenderChunkPictureCache,
  costs: TileCostModel,
  key: TileKey,
  moving: boolean
): number {
  const chunks = tileChunks(index, key)
  if (chunks.length === 0) return 0
  if (
    moving &&
    chunks.some(
      (chunk) =>
        (chunk.kind !== 'subtree' || chunk.interruptible) && !pictureCache.has(renderer, chunk)
    )
  ) {
    return Number.POSITIVE_INFINITY
  }
  return costs.estimate(key, chunks.length)
}

/**
 * Recording a chunk's picture is the dear part of a tile, so a tile whose chunks are not all
 * recorded yet records them until the frame's budget is spent and defers the rest; the tile
 * itself renders, from recorded pictures, on the frame that finds them all present. False when
 * some remain for the next frame.
 */
export function recordTilePictures(
  renderer: SkiaRenderer,
  graph: SceneGraph,
  index: RenderChunkIndex,
  pictureCache: RenderChunkPictureCache,
  key: TileKey,
  budget: { now: () => number; remainingMs: number }
): boolean {
  const deadline = budget.now() + budget.remainingMs
  let recorded = 0
  // Pictures record at the tile's detail, so their image previews suit its level.
  const previousDetail = renderer.imageDetailScale
  renderer.imageDetailScale = key.level
  try {
    for (const chunk of tileChunks(index, key)) {
      if (chunk.kind === 'subtree' && !chunk.interruptible) continue
      if (pictureCache.has(renderer, chunk)) continue
      if (recorded > 0 && budget.now() >= deadline) return false
      pictureCache.get(renderer, graph, chunk)
      recorded++
    }
  } finally {
    renderer.imageDetailScale = previousDetail
  }
  return true
}
