import RBush from 'rbush'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import { computeDescendantVisualBounds } from '@open-pencil/scene-graph/geometry'
import type { Mat3 } from '@open-pencil/scene-graph/matrix'
import Matrix from '@open-pencil/scene-graph/matrix'

import { worldNodeVisualBounds } from '#core/canvas/renderer/visual-bounds'

export type RenderChunkKind = 'self' | 'subtree'

export interface RenderChunkContext {
  parentTransform: Mat3
  ancestorClipIds: string[]
}

export interface RenderChunk {
  id: string
  nodeId: string
  kind: RenderChunkKind
  context: RenderChunkContext
  interruptible: boolean
  painterOrder: number
  minX: number
  minY: number
  maxX: number
  maxY: number
  nodeCount: number
  estimatedCost: number
}

export interface RenderChunkBuildStats {
  nodesVisited: number
  chunksBuilt: number
  maximumChunkNodes: number
  maximumAtomicChunkNodes: number
  oversizedAtomicChunks: number
}

const MAX_CHUNK_NODES = 32

function requiresAtomicSubtree(graph: SceneGraph, node: SceneNode): boolean {
  const isolated =
    node.opacity < 1 ||
    (node.blendMode !== 'NORMAL' && node.blendMode !== 'PASS_THROUGH') ||
    node.effects.some(
      (effect) =>
        effect.visible &&
        (effect.type === 'LAYER_BLUR' ||
          effect.type === 'FOREGROUND_BLUR' ||
          effect.type === 'BACKGROUND_BLUR')
    )
  const hasMasks = node.childIds.some((childId) => graph.getNode(childId)?.isMask === true)
  return isolated || hasMasks
}

function shouldSplit(graph: SceneGraph, node: SceneNode, descendantCount: number): boolean {
  return (
    node.childIds.length > 0 &&
    descendantCount > MAX_CHUNK_NODES &&
    !requiresAtomicSubtree(graph, node)
  )
}

function estimateCost(nodeCount: number, node: SceneNode): number {
  const visibleEffects = node.effects.filter((effect) => effect.visible).length
  return nodeCount + visibleEffects * 8
}

function subtreeBounds(graph: SceneGraph, nodeId: string) {
  return computeDescendantVisualBounds(
    [nodeId],
    (id) => graph.getNode(id),
    (id) => graph.getAbsolutePosition(id)
  )
}

function clipAncestorIds(graph: SceneGraph, node: SceneNode): string[] {
  const ids: string[] = []
  let parent = node.parentId ? graph.getNode(node.parentId) : undefined
  while (parent) {
    if (parent.clipsContent) ids.unshift(parent.id)
    parent = parent.parentId ? graph.getNode(parent.parentId) : undefined
  }
  return ids
}

function chunkContext(graph: SceneGraph, node: SceneNode): RenderChunkContext {
  const parent = node.parentId ? graph.getNode(node.parentId) : undefined
  return {
    parentTransform: parent ? getWorldMatrix(parent, graph) : Matrix.identity(),
    ancestorClipIds: clipAncestorIds(graph, node)
  }
}

function countDescendants(graph: SceneGraph, nodeIds: string[]) {
  const counts = new Map<string, number>()
  let visited = 0
  const stack: Array<{ nodeId: string; expanded: boolean }> = nodeIds.map((nodeId) => ({
    nodeId,
    expanded: false
  }))
  while (stack.length > 0) {
    const entry = stack.pop()
    if (!entry) continue
    const node = graph.getNode(entry.nodeId)
    if (!node?.visible) continue
    if (!entry.expanded) {
      visited++
      stack.push({ nodeId: entry.nodeId, expanded: true })
      for (const childId of node.childIds) stack.push({ nodeId: childId, expanded: false })
      continue
    }
    let count = 1
    for (const childId of node.childIds) count += counts.get(childId) ?? 0
    counts.set(node.id, count)
  }
  return { counts, visited }
}

function buildChunks(graph: SceneGraph, nodeIds: string[], counts: Map<string, number>) {
  const chunks: RenderChunk[] = []
  let painterOrder = 0
  const stack = [...nodeIds].reverse()
  while (stack.length > 0) {
    const nodeId = stack.pop()
    if (!nodeId) continue
    const node = graph.getNode(nodeId)
    if (!node?.visible) continue
    const descendantCount = counts.get(nodeId) ?? 1
    const split = shouldSplit(graph, node, descendantCount)
    const kind: RenderChunkKind = split ? 'self' : 'subtree'
    const bounds = split ? worldNodeVisualBounds(graph, node) : subtreeBounds(graph, nodeId)
    if (bounds) {
      const nodeCount = split ? 1 : descendantCount
      chunks.push({
        id: `${nodeId}:${kind}`,
        nodeId,
        kind,
        context: chunkContext(graph, node),
        interruptible: split || !requiresAtomicSubtree(graph, node),
        painterOrder: painterOrder++,
        ...bounds,
        nodeCount,
        estimatedCost: estimateCost(nodeCount, node)
      })
    }
    if (!split) continue
    for (let childIndex = node.childIds.length - 1; childIndex >= 0; childIndex--) {
      const childId = node.childIds[childIndex]
      if (childId) stack.push(childId)
    }
  }
  return chunks
}

export class RenderChunkIndex {
  private readonly tree = new RBush<RenderChunk>()
  private readonly chunks = new Map<string, RenderChunk>()
  private readonly chunkIdsByNode = new Map<string, Set<string>>()
  private readonly chunkIdsByDependency = new Map<string, Set<string>>()

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
    const chunks = buildChunks(graph, page.childIds, counts)
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
    this.tree.clear()
    this.chunks.clear()
    this.chunkIdsByNode.clear()
    this.chunkIdsByDependency.clear()
    this.tree.load(chunks)
    for (const chunk of chunks) {
      this.chunks.set(chunk.id, chunk)
      const ids = this.chunkIdsByNode.get(chunk.nodeId) ?? new Set<string>()
      ids.add(chunk.id)
      this.chunkIdsByNode.set(chunk.nodeId, ids)
      if (graph) this.indexDependencies(graph, chunk)
    }
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
      if (!bounds) continue
      Object.assign(chunk, bounds, { context: chunkContext(graph, node) })
      this.tree.insert(chunk)
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
  }

  size(): number {
    return this.chunks.size
  }

  dispose(): void {
    this.tree.clear()
    this.chunks.clear()
    this.chunkIdsByNode.clear()
    this.chunkIdsByDependency.clear()
  }
}

export { RenderChunkPictureCache } from './cache'
export {
  deleteRecordedRenderChunks,
  drawRecordedRenderChunks,
  drawRenderChunkDirect,
  recordRenderChunk
} from './record'
export type { RecordedRenderChunk } from './record'
