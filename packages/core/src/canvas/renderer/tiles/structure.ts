import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import type {
  RenderChunk,
  RenderChunkIndex,
  RenderChunkPictureCache
} from '#core/canvas/renderer/chunks'

import type { TileImageCache } from './cache'
import type { TileWorldBounds } from './geometry'

/** Structural changes a frame applies one subtree at a time; more rebuild the whole page. */
const MAX_INCREMENTAL_STRUCTURE_CHANGES = 32

/** A layer that changed, with the bounds of the chunks that drew it before the change. */
export interface PendingInvalidation {
  nodeId: string
  previousBounds: TileWorldBounds[]
}

/** A layer added, removed, or moved, with the parent that reported it. */
export interface PendingStructureChange {
  nodeId: string
  parentId: string | null
}

/** What a page's changes are applied to: its chunk index and the caches built from it. */
export interface PageTiles {
  index: RenderChunkIndex
  pageId: string
  pictureCache: RenderChunkPictureCache
  tileCache: TileImageCache
}

type ChunkChange = { removed: RenderChunk[]; added: RenderChunk[]; reordered?: boolean }

/**
 * Applies the layers' changes to the page: each chunk that drew a changed layer drops its
 * picture and takes its new bounds, and the tiles under its old bounds and its new ones are
 * marked for rendering again.
 */
export function applyInvalidations(
  page: PageTiles,
  graph: SceneGraph,
  invalidations: readonly PendingInvalidation[],
  contentGeneration: number
): void {
  const { index, pageId, pictureCache, tileCache } = page
  tileCache.advanceGeneration(contentGeneration)
  for (const invalidation of invalidations) {
    const before = invalidation.previousBounds
    const chunks = index.getChunksDependingOnNode(invalidation.nodeId)
    for (const chunk of chunks) pictureCache.invalidate(chunk.id)
    for (const chunk of chunks) index.updateNode(graph, chunk.nodeId)
    const after = index.getChunksDependingOnNode(invalidation.nodeId)
    for (const bounds of [...before, ...after]) {
      tileCache.invalidateBounds(pageId, bounds, contentGeneration)
    }
  }
}

/**
 * Applies the structural changes to the page, one layer at a time: the chunks of the smallest
 * subtree that held each are built again, their pictures dropped, and the tiles they touched
 * marked for rendering again. False when the page must be built from nothing instead: the page
 * is gone, a change cannot be placed, or a bulk edit such as a paste of hundreds of layers would
 * read the whole index once per layer.
 */
export function applyStructureChanges(
  page: PageTiles,
  graph: SceneGraph,
  changes: readonly PendingStructureChange[],
  contentGeneration: number
): boolean {
  const { index, pageId, pictureCache, tileCache } = page
  if (!graph.getNode(pageId)) return false
  if (changes.length > MAX_INCREMENTAL_STRUCTURE_CHANGES) return false
  tileCache.advanceGeneration(contentGeneration)
  let reordered = false
  const rebuiltIds = new Set<string>()
  for (const { nodeId, parentId } of changes) {
    // A layer is rebuilt once, however many parents reported it: a move reports both.
    if (rebuiltIds.has(nodeId)) continue
    rebuiltIds.add(nodeId)
    const node = graph.getNode(nodeId)
    let changed: ChunkChange | null = null
    if (node) changed = rebuildLayer(graph, index, pageId, node)
    else if (parentId) changed = index.pruneUnder(graph, pageId, parentId)
    if (!changed) return false
    reordered ||= changed.reordered === true
    for (const chunk of changed.removed) pictureCache.invalidate(chunk.id)
    for (const chunk of changed.removed)
      tileCache.invalidateBounds(pageId, chunk, contentGeneration)
    for (const chunk of changed.added) tileCache.invalidateBounds(pageId, chunk, contentGeneration)
  }
  if (reordered) index.renumber(graph, pageId)
  return true
}

/**
 * Rebuilds the chunks of a layer added, moved, or reordered, where it is now: a page child's top
 * whole, which also drops the chunks of a layer that left the page, or else the layer's own
 * chunks under its nearest chunk owner; and the subtree chunks that drew it on its old path are
 * built again without it, so a move leaves no ghost behind. A page child changes the draw order
 * of all, which the caller renumbers.
 */
function rebuildLayer(
  graph: SceneGraph,
  index: RenderChunkIndex,
  pageId: string,
  node: SceneNode
): ChunkChange | null {
  const holding = index.chunksHolding(graph, node.id)
  const removed: RenderChunk[] = []
  const added: RenderChunk[] = []
  const merge = (change: ChunkChange | null) => {
    if (!change) return false
    removed.push(...change.removed)
    added.push(...change.added)
    return true
  }
  const reordered = node.parentId === pageId || index.hasTop(node.id)
  if (reordered) merge(index.rebuildTop(graph, pageId, node.id))
  if (node.parentId !== pageId) {
    removed.push(...index.dropChunksOf(graph, node.id))
    if (!merge(index.rebuildFrom(graph, pageId, node.id))) return null
  }
  for (const chunk of holding) {
    // Replaced already when the old path and the new one share the owner.
    if (!index.has(chunk.id)) continue
    if (!merge(index.rebuildFrom(graph, pageId, chunk.nodeId))) return null
  }
  return { removed, added, reordered }
}
