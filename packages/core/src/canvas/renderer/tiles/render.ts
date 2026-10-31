import type { Image as CKImage } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { paintPageBackground } from '#core/canvas/page/background'
import type { SkiaRenderer } from '#core/canvas/renderer'
import {
  type RenderChunk,
  type RenderChunkIndex,
  type RenderChunkPictureCache,
  drawRenderChunkDirect
} from '#core/canvas/renderer/chunks'
import { rendererNow } from '#core/canvas/renderer/clock'

import { type TileKey, tileWorldBounds } from './geometry'
import type { TileSurfacePool } from './surface-pool'

export interface RenderedTile {
  key: TileKey
  image: CKImage
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
  const allocationStartedAt = rendererNow()
  const surface = surfacePool.acquire(renderer)
  if (!surface) return null
  const allocationMs = rendererNow() - allocationStartedAt
  const canvas = surface.getCanvas()
  canvas.save()
  try {
    const origin = { x: -bounds.minX * key.level, y: -bounds.minY * key.level }
    paintPageBackground(renderer, canvas, origin, key.level)
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
    surfacePool.release(surface)
  }
}

export function deleteRenderedTile(tile: RenderedTile): void {
  tile.image.delete()
}

export function tileChunks(index: RenderChunkIndex, key: TileKey): RenderChunk[] {
  return index.search(tileWorldBounds(key))
}
