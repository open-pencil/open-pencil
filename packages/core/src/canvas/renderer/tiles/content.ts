import type { SceneGraph } from '@open-pencil/scene-graph'

import {
  nodeRequiresAtomicChunk,
  RenderChunkIndex,
  type RenderChunkPictureCache
} from '#core/canvas/renderer/chunks'

import type { TileImageCache } from './cache'
import {
  applyInvalidations,
  applyStructureChanges,
  type PageTiles,
  type PendingInvalidation,
  type PendingStructureChange
} from './structure'

/**
 * The page the tiles show: its chunk index, the content generation the tiles were built for,
 * and the layer changes recorded since the last frame, applied to the index and the caches
 * built from it when the next frame starts.
 */
export class TilePageContent {
  private chunkIndex: RenderChunkIndex | null = null
  private page: string | null = null
  private contentGeneration = -1
  private pendingInvalidations: PendingInvalidation[] = []
  /** Layers added, removed, moved between parents, or changed in kind since the last frame. */
  private pendingStructure: PendingStructureChange[] = []
  /** When the content last changed, so the background stages wait for a quiet spell. */
  private changedAt = Number.NEGATIVE_INFINITY

  constructor(
    private readonly now: () => number,
    private readonly pictureCache: RenderChunkPictureCache,
    private readonly tileCache: TileImageCache
  ) {}

  /** The page's chunk index, null until a frame builds it. */
  get index(): RenderChunkIndex | null {
    return this.chunkIndex
  }

  /** The content generation the index and the tiles reflect. */
  get generation(): number {
    return this.contentGeneration
  }

  /** When a recorded change last reached the index. */
  get lastChangeAt(): number {
    return this.changedAt
  }

  /**
   * Records that `nodeId` changed, with the bounds of the chunks that drew it; a change that
   * moves it between interruptible and atomic chunks reshapes them and counts as structural.
   */
  invalidateNode(nodeId: string, graph?: SceneGraph): void {
    const chunks = this.chunkIndex?.getChunksDependingOnNode(nodeId) ?? []
    const owningChunks = this.chunkIndex?.getChunksForNode(nodeId) ?? []
    const node = graph?.getNode(nodeId)
    if (
      graph &&
      node &&
      owningChunks.some((chunk) => chunk.interruptible === nodeRequiresAtomicChunk(graph, node))
    ) {
      this.invalidateStructure(nodeId, node.parentId)
      return
    }
    this.pendingInvalidations.push({
      nodeId,
      previousBounds: chunks.map(({ minX, minY, maxX, maxY }) => ({ minX, minY, maxX, maxY }))
    })
  }

  /** Records that `nodeId` was added, removed, or moved under another parent. */
  invalidateStructure(nodeId: string, parentId?: string | null): void {
    if (!this.chunkIndex) return
    this.pendingStructure.push({ nodeId, parentId: parentId ?? null })
  }

  /** Whether changes recorded since the last frame still await it. */
  hasPendingWork(): boolean {
    return this.pendingInvalidations.length > 0 || this.pendingStructure.length > 0
  }

  /**
   * Brings the index up to the frame: applies the recorded changes to the page it was built
   * for, and builds it for `pageId` when there is none. `invalidate` drops every tile, as when
   * the page changed or its structure changed too much to apply a subtree at a time.
   */
  sync(
    graph: SceneGraph,
    pageId: string | null,
    contentGeneration: number,
    invalidate: () => void
  ): void {
    // Node changes arrive through invalidateNode() and structural ones through
    // invalidateStructure(), so a new content generation on its own is a redraw request (every
    // requestRender() bumps it) and the rendered tiles stay valid. Invalidations also arrive
    // without a new generation, as when an image preview decodes.
    if (this.chunkIndex && this.page === pageId && this.pendingStructure.length > 0) {
      this.applyPendingStructure(graph, contentGeneration, invalidate)
    }
    if (
      this.chunkIndex &&
      this.page === pageId &&
      (this.contentGeneration !== contentGeneration || this.pendingInvalidations.length > 0)
    ) {
      this.applyPendingInvalidations(graph, contentGeneration)
    }
    if (this.chunkIndex && this.page !== pageId) invalidate()
    // Without an index nothing can be shown, so a page that arrives mid-gesture builds its index
    // at once; its tiles then fill in under the moving budget rather than after the gesture.
    if (this.chunkIndex === null && pageId) {
      this.ensureIndex(graph, pageId, contentGeneration)
    }
  }

  /** Drops the index and every recorded change. */
  reset(): void {
    this.chunkIndex?.dispose()
    this.chunkIndex = null
    this.page = null
    this.contentGeneration = -1
    this.changedAt = Number.NEGATIVE_INFINITY
    this.pendingInvalidations = []
    this.pendingStructure = []
  }

  private applyPendingInvalidations(graph: SceneGraph, contentGeneration: number): void {
    const page = this.pageTiles()
    if (!page) return
    applyInvalidations(page, graph, this.pendingInvalidations, contentGeneration)
    if (this.pendingInvalidations.length > 0) this.changedAt = this.now()
    this.pendingInvalidations = []
    this.contentGeneration = contentGeneration
  }

  private applyPendingStructure(
    graph: SceneGraph,
    contentGeneration: number,
    invalidate: () => void
  ): void {
    const page = this.pageTiles()
    if (!page) return
    if (!applyStructureChanges(page, graph, this.pendingStructure, contentGeneration)) {
      invalidate()
      return
    }
    this.pendingStructure = []
    this.contentGeneration = contentGeneration
    this.changedAt = this.now()
  }

  private pageTiles(): PageTiles | null {
    if (!this.chunkIndex || !this.page) return null
    return {
      index: this.chunkIndex,
      pageId: this.page,
      pictureCache: this.pictureCache,
      tileCache: this.tileCache
    }
  }

  private ensureIndex(graph: SceneGraph, pageId: string | null, contentGeneration: number): void {
    if (this.chunkIndex && this.page === pageId && this.contentGeneration === contentGeneration) {
      return
    }
    this.chunkIndex?.dispose()
    this.pictureCache.clear()
    this.tileCache.markStale(contentGeneration)
    this.page = pageId
    this.contentGeneration = contentGeneration
    // A fresh index already reflects every change recorded before it was built.
    this.pendingInvalidations = []
    this.chunkIndex = pageId ? RenderChunkIndex.build(graph, pageId).index : null
  }
}
