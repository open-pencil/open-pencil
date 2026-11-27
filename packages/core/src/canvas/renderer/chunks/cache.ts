import type { SkPicture } from '@open-pencil/canvaskit'
import type { SceneGraph } from '@open-pencil/scene-graph'
import type { VisualBounds } from '@open-pencil/scene-graph/geometry'

import type { SkiaRenderer } from '#core/canvas/renderer/skia'

import { MAX_CHUNK_NODES, subtreeBounds } from './build'
import type { RenderChunk } from './index'
import { recordRenderChunk } from './record'

interface CachedChunkPicture {
  picture: SkPicture
  fontGeneration: number
  /** The detail the picture's image previews were chosen for; none when it drew no preview. */
  previewDetail: number | null
}

/** Read after recording, through a call, so the flag reset before it is not taken as final. */
function drewPreviews(renderer: Pick<SkiaRenderer, 'images'>): boolean {
  return renderer.images.previewsDrawn
}

/** What each visible layer of a subtree chunk draws, keyed by layer, as one recording drew it. */
function layerBounds(graph: SceneGraph, rootId: string): Map<string, VisualBounds> {
  const layers = new Map<string, VisualBounds>()
  const pending = [rootId]
  while (pending.length > 0) {
    const id = pending.pop()
    const node = id === undefined ? undefined : graph.getNode(id)
    if (!node?.visible) continue
    const bounds = subtreeBounds(graph, node.id)
    if (bounds) layers.set(node.id, bounds)
    for (const childId of node.childIds) pending.push(childId)
  }
  return layers
}

export class RenderChunkPictureCache {
  private readonly entries = new Map<string, CachedChunkPicture>()
  /**
   * The layers of each subtree chunk where its latest picture drew them. The tiles show that
   * picture, so a layer's change redraws only where it was and where it is now. A dropped
   * picture keeps its layers until the chunk is recorded again, as its tiles still show them.
   */
  private readonly drawnLayers = new Map<string, Map<string, VisualBounds>>()

  /**
   * A picture holds for the renderer's fonts, and, when it drew image previews, for a detail no
   * finer than it was recorded at: a tile two levels in asks for sharper previews than one
   * recorded at a page's fit zoom, and gets them recorded again.
   */
  private current(renderer: SkiaRenderer, cached: CachedChunkPicture | undefined): boolean {
    return (
      cached !== undefined &&
      cached.fontGeneration === renderer.fontGeneration &&
      (cached.previewDetail === null || cached.previewDetail >= renderer.images.detailScale)
    )
  }

  get(renderer: SkiaRenderer, graph: SceneGraph, chunk: RenderChunk): SkPicture {
    const cached = this.entries.get(chunk.id)
    if (cached && this.current(renderer, cached)) return cached.picture
    cached?.picture.delete()
    this.entries.delete(chunk.id)
    renderer.images.previewsDrawn = false
    const recorded = recordRenderChunk(renderer, graph, chunk)
    // A chunk is split past this many layers unless it draws as one, as under opacity or a mask;
    // recording every layer of a larger one would cost more than redrawing it whole.
    if (chunk.kind === 'subtree' && chunk.nodeCount <= MAX_CHUNK_NODES) {
      this.drawnLayers.set(chunk.id, layerBounds(graph, chunk.nodeId))
    } else {
      this.drawnLayers.delete(chunk.id)
    }
    this.entries.set(chunk.id, {
      picture: recorded.picture,
      fontGeneration: renderer.fontGeneration,
      previewDetail: drewPreviews(renderer) ? renderer.images.detailScale : null
    })
    return recorded.picture
  }

  /** Whether `chunk`'s picture is recorded for the renderer's current fonts and detail. */
  has(renderer: SkiaRenderer, chunk: RenderChunk): boolean {
    return this.current(renderer, this.entries.get(chunk.id))
  }

  invalidate(chunkId: string): void {
    const entry = this.entries.get(chunkId)
    entry?.picture.delete()
    this.entries.delete(chunkId)
  }

  /** Drops `chunkId`'s picture and the layers it drew, as when the chunk is built again. */
  forget(chunkId: string): void {
    this.invalidate(chunkId)
    this.drawnLayers.delete(chunkId)
  }

  /**
   * Where the latest picture of `chunkId` drew `nodeId`: null when it drew nothing of it, and
   * undefined when no picture of the chunk recorded its layers.
   */
  drawnBounds(chunkId: string, nodeId: string): VisualBounds | null | undefined {
    const layers = this.drawnLayers.get(chunkId)
    if (!layers) return undefined
    return layers.get(nodeId) ?? null
  }

  clear(): void {
    for (const entry of this.entries.values()) entry.picture.delete()
    this.entries.clear()
    this.drawnLayers.clear()
  }

  size(): number {
    return this.entries.size
  }
}
