import type { SkPicture } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'

import type { RenderChunk } from './index'
import { recordRenderChunk } from './record'

interface CachedChunkPicture {
  picture: SkPicture
  fontGeneration: number
}

export class RenderChunkPictureCache {
  private readonly entries = new Map<string, CachedChunkPicture>()

  get(renderer: SkiaRenderer, graph: SceneGraph, chunk: RenderChunk): SkPicture {
    const cached = this.entries.get(chunk.id)
    if (cached?.fontGeneration === renderer.fontGeneration) return cached.picture
    cached?.picture.delete()
    const recorded = recordRenderChunk(renderer, graph, chunk)
    this.entries.set(chunk.id, {
      picture: recorded.picture,
      fontGeneration: renderer.fontGeneration
    })
    return recorded.picture
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
