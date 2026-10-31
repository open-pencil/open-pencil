import RBush from 'rbush'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { worldNodeVisualBounds } from '#core/canvas/renderer/visual-bounds'

import {
  buildChunks,
  chunkContext,
  countDescendants,
  MAX_CHUNK_NODES,
  PAINTER_ORDER_SPAN,
  painterOrderOf,
  type RenderChunk,
  type RenderChunkBuildStats,
  subtreeBounds
} from './build'

export { nodeRequiresAtomicChunk } from './build'
export type {
  RenderChunk,
  RenderChunkBuildStats,
  RenderChunkContext,
  RenderChunkKind
} from './build'

export class RenderChunkIndex {
  private readonly tree = new RBush<RenderChunk>()
  private readonly chunks = new Map<string, RenderChunk>()
  private readonly chunkIdsByNode = new Map<string, Set<string>>()
  private readonly chunkIdsByDependency = new Map<string, Set<string>>()
  private readonly dependenciesByChunk = new Map<string, string[]>()
  private readonly chunkIdsByTop = new Map<string, Set<string>>()
  /** The bounds of every chunk, computed when asked and dropped when the chunks change. */
  private cachedBounds: Pick<RenderChunk, 'minX' | 'minY' | 'maxX' | 'maxY'> | null | undefined

  static build(
    graph: SceneGraph,
    pageId: string
  ): { index: RenderChunkIndex; stats: RenderChunkBuildStats } {
    const index = new RenderChunkIndex()
    const page = graph.getNode(pageId)
    if (!page) {
      return {
        index,
        stats: {
          nodesVisited: 0,
          chunksBuilt: 0,
          maximumChunkNodes: 0,
          maximumAtomicChunkNodes: 0,
          oversizedAtomicChunks: 0
        }
      }
    }

    const { counts, visited } = countDescendants(graph, page.childIds)
    const chunks = page.childIds.flatMap((topId, topIndex) =>
      buildChunks(graph, topId, topId, topIndex, counts)
    )
    index.bulkLoad(chunks, graph)
    return {
      index,
      stats: {
        nodesVisited: visited,
        chunksBuilt: chunks.length,
        maximumChunkNodes: chunks.reduce((maximum, chunk) => Math.max(maximum, chunk.nodeCount), 0),
        maximumAtomicChunkNodes: chunks.reduce(
          (maximum, chunk) => (chunk.interruptible ? maximum : Math.max(maximum, chunk.nodeCount)),
          0
        ),
        oversizedAtomicChunks: chunks.filter(
          (chunk) => !chunk.interruptible && chunk.nodeCount > MAX_CHUNK_NODES
        ).length
      }
    }
  }

  bulkLoad(chunks: RenderChunk[], graph?: SceneGraph): void {
    this.dispose()
    this.tree.load(chunks)
    for (const chunk of chunks) this.register(chunk, graph)
  }

  private register(chunk: RenderChunk, graph?: SceneGraph): void {
    this.chunks.set(chunk.id, chunk)
    const ids = this.chunkIdsByNode.get(chunk.nodeId) ?? new Set<string>()
    ids.add(chunk.id)
    this.chunkIdsByNode.set(chunk.nodeId, ids)
    const topIds = this.chunkIdsByTop.get(chunk.topId) ?? new Set<string>()
    topIds.add(chunk.id)
    this.chunkIdsByTop.set(chunk.topId, topIds)
    if (graph) this.indexDependencies(graph, chunk)
  }

  private unregister(chunk: RenderChunk): void {
    this.tree.remove(chunk)
    this.chunks.delete(chunk.id)
    this.chunkIdsByNode.get(chunk.nodeId)?.delete(chunk.id)
    this.chunkIdsByTop.get(chunk.topId)?.delete(chunk.id)
    for (const dependencyId of this.dependenciesByChunk.get(chunk.id) ?? []) {
      this.chunkIdsByDependency.get(dependencyId)?.delete(chunk.id)
    }
    this.dependenciesByChunk.delete(chunk.id)
  }

  /** Whether `nodeId` is a page child whose subtree the index holds chunks for. */
  hasTop(nodeId: string): boolean {
    return (this.chunkIdsByTop.get(nodeId)?.size ?? 0) > 0
  }

  /**
   * Replaces the chunks of the page child `topId`'s subtree with ones built from the graph as it
   * is now, or only removes them when the page no longer shows it. Returns both sets, so the
   * caller can drop their pictures and the tiles they covered or cover.
   */
  rebuildTop(
    graph: SceneGraph,
    pageId: string,
    topId: string
  ): { removed: RenderChunk[]; added: RenderChunk[] } {
    const removed = [...(this.chunkIdsByTop.get(topId) ?? [])].flatMap((id) => {
      const chunk = this.chunks.get(id)
      return chunk ? [chunk] : []
    })
    for (const chunk of removed) this.unregister(chunk)
    const topIndex = graph.getNode(pageId)?.childIds.indexOf(topId) ?? -1
    const added =
      topIndex >= 0
        ? buildChunks(graph, topId, topId, topIndex, countDescendants(graph, [topId]).counts)
        : []
    for (const chunk of added) {
      this.tree.insert(chunk)
      this.register(chunk, graph)
    }
    if (removed.length > 0 || added.length > 0) this.cachedBounds = undefined
    return { removed, added }
  }

  /**
   * Replaces the chunks a change at `nodeId` can affect, so a layer added or removed deep in a
   * large page rebuilds a few chunks rather than the page child's thousands: the nearest
   * chunk-owning ancestor's subtree when that ancestor is one chunk, or, when it is split into
   * children, only the child subtree on the way to the layer. New chunks take draw orders between
   * their neighbours'. Null when no chunk on the page holds the layer, which a caller answers by
   * rebuilding everything.
   */
  rebuildFrom(
    graph: SceneGraph,
    pageId: string,
    nodeId: string
  ): { removed: RenderChunk[]; added: RenderChunk[] } | null {
    const found = this.chunkOwnerOf(graph, nodeId)
    if (!found) return null
    const { owner, ownerChunk, path } = found
    if (ownerChunk.kind === 'subtree') return this.rebuildOwner(graph, pageId, owner, ownerChunk)
    // The owner draws itself and each child subtree apart: only the one on the path changes.
    const child = path.at(-1)
    if (!child) return this.rebuildOwner(graph, pageId, owner, ownerChunk)
    return this.replaceSubtree(graph, pageId, ownerChunk.topId, owner.id, child.id)
  }

  /**
   * The nearest layer from `nodeId` upward that owns a chunk, its chunk, and the layers passed
   * on the way, nearest the owner last; null off the page or on a parent cycle.
   */
  /** Rebuilds the chunks of `owner` whole: the top it is, or its subtree within its top. */
  private rebuildOwner(
    graph: SceneGraph,
    pageId: string,
    owner: SceneNode,
    ownerChunk: RenderChunk
  ): { removed: RenderChunk[]; added: RenderChunk[] } | null {
    if (owner.parentId === pageId) return this.rebuildTop(graph, pageId, owner.id)
    return this.replaceSubtree(graph, pageId, ownerChunk.topId, owner.id, owner.id)
  }

  private chunkOwnerOf(
    graph: SceneGraph,
    nodeId: string
  ): { owner: SceneNode; ownerChunk: RenderChunk; path: SceneNode[] } | null {
    const path: SceneNode[] = []
    const seen = new Set<string>()
    let node = graph.getNode(nodeId)
    while (node && !seen.has(node.id) && (this.chunkIdsByNode.get(node.id)?.size ?? 0) === 0) {
      seen.add(node.id)
      path.push(node)
      node = node.parentId ? graph.getNode(node.parentId) : undefined
    }
    if (!node || seen.has(node.id)) return null
    const ownerChunk = this.getChunksForNode(node.id).at(0)
    return ownerChunk ? { owner: node, ownerChunk, path } : null
  }

  /**
   * Under a split owner: the chunks of layers that are gone or no longer under it, and the roots
   * of subtree chunks that recorded a layer since removed.
   */
  private danglingUnder(
    graph: SceneGraph,
    ownerId: string
  ): { removed: RenderChunk[]; stale: string[] } {
    const removed: RenderChunk[] = []
    const stale: string[] = []
    for (const chunk of this.getChunksDependingOnNode(ownerId)) {
      if (chunk.nodeId === ownerId) continue
      if (!graph.getNode(chunk.nodeId) || !this.isUnder(graph, chunk.nodeId, ownerId)) {
        removed.push(chunk)
        continue
      }
      const dependencies = this.dependenciesByChunk.get(chunk.id) ?? []
      if (chunk.kind === 'subtree' && dependencies.some((id) => !graph.getNode(id))) {
        stale.push(chunk.nodeId)
      }
    }
    return { removed, stale }
  }

  /** Whether `nodeId` is `ancestorId` or lies under it. */
  private isUnder(graph: SceneGraph, nodeId: string, ancestorId: string): boolean {
    const seen = new Set<string>()
    let node = graph.getNode(nodeId)
    while (node && !seen.has(node.id)) {
      if (node.id === ancestorId) return true
      seen.add(node.id)
      node = node.parentId ? graph.getNode(node.parentId) : undefined
    }
    return false
  }

  /**
   * Removes the chunks `nodeId` and its descendants own, before the layer is rebuilt where it
   * now is; a chunk of an ancestor's subtree that holds the layer stays for `rebuildFrom`.
   */
  /** Whether the chunk `id` is still in the index. */
  has(id: string): boolean {
    return this.chunks.has(id)
  }

  /**
   * The subtree chunks of `nodeId`'s ancestors that drew it, as the index last built them: after
   * a move they still hold the layer at its old place until they are built again.
   */
  chunksHolding(graph: SceneGraph, nodeId: string): RenderChunk[] {
    return this.getChunksDependingOnNode(nodeId).filter(
      (chunk) => chunk.nodeId !== nodeId && !this.isUnder(graph, chunk.nodeId, nodeId)
    )
  }

  dropChunksOf(graph: SceneGraph, nodeId: string): RenderChunk[] {
    const removed = this.getChunksDependingOnNode(nodeId).filter(
      (chunk) => chunk.nodeId === nodeId || this.isUnder(graph, chunk.nodeId, nodeId)
    )
    for (const chunk of removed) this.unregister(chunk)
    if (removed.length > 0) this.cachedBounds = undefined
    return removed
  }

  /**
   * After a layer under `parentId` was removed: drops the chunks of layers that are gone and
   * rebuilds the subtree chunks that recorded one, without touching the parent's other children.
   */
  pruneUnder(
    graph: SceneGraph,
    pageId: string,
    parentId: string
  ): { removed: RenderChunk[]; added: RenderChunk[] } | null {
    const found = this.chunkOwnerOf(graph, parentId)
    if (!found) return null
    const { owner, ownerChunk } = found
    if (ownerChunk.kind === 'subtree') return this.rebuildOwner(graph, pageId, owner, ownerChunk)
    const { removed, stale } = this.danglingUnder(graph, owner.id)
    for (const chunk of removed) this.unregister(chunk)
    const added: RenderChunk[] = []
    for (const rootId of stale) {
      const rebuilt = this.replaceSubtree(graph, pageId, ownerChunk.topId, owner.id, rootId)
      if (rebuilt) {
        removed.push(...rebuilt.removed)
        added.push(...rebuilt.added)
      }
    }
    if (removed.length > 0) this.cachedBounds = undefined
    return { removed, added }
  }

  /** Rebuilds the chunks of `rootId`'s subtree, a child subtree of `ownerId` or the owner itself. */
  private replaceSubtree(
    graph: SceneGraph,
    pageId: string,
    topId: string,
    ownerId: string,
    rootId: string
  ): { removed: RenderChunk[]; added: RenderChunk[] } | null {
    const topIndex = graph.getNode(pageId)?.childIds.indexOf(topId) ?? -1
    if (topIndex < 0) return null
    const removed = this.getChunksDependingOnNode(rootId)
    const { start, end } = this.orderWindow(graph, topId, topIndex, ownerId, rootId, removed)
    for (const chunk of removed) this.unregister(chunk)
    const counts = countDescendants(graph, [rootId]).counts
    const built = buildChunks(graph, rootId, topId, topIndex, counts)
    const step = (end - start) / (built.length + 1)
    // Each insertion halves the gap to the neighbour; once the gap is below a double's
    // resolution the orders would collide, so the top is numbered afresh instead.
    if (start + step === start || end - step === end) {
      const top = this.rebuildTop(graph, pageId, topId)
      return { removed: [...removed, ...top.removed], added: top.added }
    }
    for (const [position, chunk] of built.entries()) {
      chunk.painterOrder = start + step * (position + 1)
      chunk.localOrder = chunk.painterOrder - topIndex * PAINTER_ORDER_SPAN
      this.tree.insert(chunk)
      this.register(chunk, graph)
    }
    this.cachedBounds = undefined
    return { removed, added: built }
  }

  /**
   * The draw orders the rebuilt chunks must fall between: those of what draws before the subtree
   * and after it. With chunks to replace, their own range bounds it; for a new subtree, the
   * nearest siblings with chunks on either side do, or the owner and what follows its subtree.
   */
  private orderWindow(
    graph: SceneGraph,
    topId: string,
    topIndex: number,
    ownerId: string,
    rootId: string,
    removed: RenderChunk[]
  ): { start: number; end: number } {
    // Replaced chunks draw first in their window, so the lower bound is just before them.
    const first =
      removed.length > 0
        ? this.orderBefore(topId, Math.min(...removed.map((chunk) => chunk.painterOrder)))
        : this.orderBeforeSibling(graph, ownerId, rootId)
    const last =
      removed.length > 0 ? Math.max(...removed.map((chunk) => chunk.painterOrder)) : first
    let end = painterOrderOf(topIndex + 1, 0)
    for (const id of this.chunkIdsByTop.get(topId) ?? []) {
      const chunk = this.chunks.get(id)
      if (chunk && chunk.painterOrder > last && chunk.painterOrder < end) end = chunk.painterOrder
    }
    return { start: first === -Infinity ? painterOrderOf(topIndex, 0) - 1 : first, end }
  }

  /**
   * The greatest draw order among the siblings before `rootId` under `ownerId`, the owner's own
   * when none of them draws, or minus infinity when nothing draws before the subtree.
   */
  private orderBeforeSibling(graph: SceneGraph, ownerId: string, rootId: string): number {
    const siblings = graph.getNode(ownerId)?.childIds ?? []
    let start = -Infinity
    for (let index = siblings.indexOf(rootId) - 1; index >= 0 && start === -Infinity; index--) {
      for (const chunk of this.getChunksDependingOnNode(siblings[index])) {
        start = Math.max(start, chunk.painterOrder)
      }
    }
    if (start === -Infinity) return this.getChunksForNode(ownerId)[0]?.painterOrder ?? -Infinity
    return start
  }

  /** The greatest draw order on the page child below `order`, or the start of its range. */
  private orderBefore(topId: string, order: number): number {
    let before = -Infinity
    for (const id of this.chunkIdsByTop.get(topId) ?? []) {
      const chunk = this.chunks.get(id)
      if (chunk && chunk.painterOrder < order && chunk.painterOrder > before)
        before = chunk.painterOrder
    }
    return before
  }

  /** Renumbers every chunk's draw order after the page's own children were reordered. */
  renumber(graph: SceneGraph, pageId: string): void {
    const childIds = graph.getNode(pageId)?.childIds ?? []
    const topIndexById = new Map(childIds.map((id, index) => [id, index]))
    for (const chunk of this.chunks.values()) {
      const topIndex = topIndexById.get(chunk.topId)
      if (topIndex !== undefined) chunk.painterOrder = painterOrderOf(topIndex, chunk.localOrder)
    }
  }

  /** The world bounds all chunks lie in, or null for an empty page. */
  bounds(): Pick<RenderChunk, 'minX' | 'minY' | 'maxX' | 'maxY'> | null {
    if (this.cachedBounds !== undefined) return this.cachedBounds
    let bounds: Pick<RenderChunk, 'minX' | 'minY' | 'maxX' | 'maxY'> | null = null
    for (const chunk of this.chunks.values()) {
      bounds = bounds
        ? {
            minX: Math.min(bounds.minX, chunk.minX),
            minY: Math.min(bounds.minY, chunk.minY),
            maxX: Math.max(bounds.maxX, chunk.maxX),
            maxY: Math.max(bounds.maxY, chunk.maxY)
          }
        : { minX: chunk.minX, minY: chunk.minY, maxX: chunk.maxX, maxY: chunk.maxY }
    }
    this.cachedBounds = bounds
    return bounds
  }

  search(bounds: Pick<RenderChunk, 'minX' | 'minY' | 'maxX' | 'maxY'>): RenderChunk[] {
    return this.tree.search(bounds).sort((a, b) => a.painterOrder - b.painterOrder)
  }

  updateNode(graph: SceneGraph, nodeId: string): number {
    const ids = this.chunkIdsByNode.get(nodeId)
    const node = graph.getNode(nodeId)
    if (!ids || !node) return 0
    let updated = 0
    for (const id of ids) {
      const chunk = this.chunks.get(id)
      if (!chunk) continue
      this.tree.remove(chunk)
      const bounds =
        chunk.kind === 'self' ? worldNodeVisualBounds(graph, node) : subtreeBounds(graph, nodeId)
      if (!bounds) {
        this.tree.insert(chunk)
        continue
      }
      Object.assign(chunk, bounds, { context: chunkContext(graph, node) })
      this.tree.insert(chunk)
      this.cachedBounds = undefined
      updated++
    }
    return updated
  }

  getChunksForNode(nodeId: string): RenderChunk[] {
    return [...(this.chunkIdsByNode.get(nodeId) ?? [])].flatMap((id) => {
      const chunk = this.chunks.get(id)
      return chunk ? [chunk] : []
    })
  }

  getChunksDependingOnNode(nodeId: string): RenderChunk[] {
    return [...(this.chunkIdsByDependency.get(nodeId) ?? [])].flatMap((id) => {
      const chunk = this.chunks.get(id)
      return chunk ? [chunk] : []
    })
  }

  private indexDependencies(graph: SceneGraph, chunk: RenderChunk): void {
    const dependencies = new Set<string>()
    let ancestor = graph.getNode(chunk.nodeId)
    while (ancestor) {
      dependencies.add(ancestor.id)
      ancestor = ancestor.parentId ? graph.getNode(ancestor.parentId) : undefined
    }
    if (chunk.kind === 'subtree') {
      const pending = [chunk.nodeId]
      const visited = new Set<string>()
      while (pending.length > 0) {
        const id = pending.pop()
        if (!id || visited.has(id)) continue
        visited.add(id)
        dependencies.add(id)
        const node = graph.getNode(id)
        if (node) pending.push(...node.childIds)
      }
    }
    for (const dependencyId of dependencies) {
      const ids = this.chunkIdsByDependency.get(dependencyId) ?? new Set<string>()
      ids.add(chunk.id)
      this.chunkIdsByDependency.set(dependencyId, ids)
    }
    this.dependenciesByChunk.set(chunk.id, [...dependencies])
  }

  size(): number {
    return this.chunks.size
  }

  dispose(): void {
    this.tree.clear()
    this.chunks.clear()
    this.chunkIdsByNode.clear()
    this.chunkIdsByDependency.clear()
    this.dependenciesByChunk.clear()
    this.chunkIdsByTop.clear()
    this.cachedBounds = undefined
  }
}

export { RenderChunkPictureCache } from './cache'
export { drawRenderChunkDirect, recordRenderChunk } from './record'
export type { RecordedRenderChunk } from './record'
