import type { SkPicture } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'

import type { RenderChunk } from './index'
import { recordRenderChunk } from './record'

interface CachedChunkPicture {
  picture: SkPicture
  fontGeneration: number
  /** The detail the picture's image previews were chosen for; none when it drew no preview. */
  previewDetail: number | null
}

/** Read after recording, through a call, so the flag reset before it is not taken as final. */
function drewPreviews(renderer: Pick<SkiaRenderer, 'previewsDrawn'>): boolean {
  return renderer.previewsDrawn
}

export class RenderChunkPictureCache {
  private readonly entries = new Map<string, CachedChunkPicture>()

  /**
   * A picture holds for the renderer's fonts, and, when it drew image previews, for a detail no
   * finer than it was recorded at: a tile two levels in asks for sharper previews than one
   * recorded at a page's fit zoom, and gets them recorded again.
   */
  private current(renderer: SkiaRenderer, cached: CachedChunkPicture | undefined): boolean {
    return (
      cached !== undefined &&
      cached.fontGeneration === renderer.fontGeneration &&
      (cached.previewDetail === null || cached.previewDetail >= renderer.imageDetailScale)
    )
  }

  get(renderer: SkiaRenderer, graph: SceneGraph, chunk: RenderChunk): SkPicture {
    const cached = this.entries.get(chunk.id)
    if (cached && this.current(renderer, cached)) return cached.picture
    cached?.picture.delete()
    this.entries.delete(chunk.id)
    renderer.previewsDrawn = false
    const recorded = recordRenderChunk(renderer, graph, chunk)
    this.entries.set(chunk.id, {
      picture: recorded.picture,
      fontGeneration: renderer.fontGeneration,
      previewDetail: drewPreviews(renderer) ? renderer.imageDetailScale : null
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

  clear(): void {
    for (const entry of this.entries.values()) entry.picture.delete()
    this.entries.clear()
  }

  size(): number {
    return this.entries.size
  }
}
