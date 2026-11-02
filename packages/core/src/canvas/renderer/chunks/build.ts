import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getNodeLocalMatrix } from '@open-pencil/scene-graph/coordinate'
import { computeDescendantVisualBounds, type VisualBounds } from '@open-pencil/scene-graph/geometry'
import type { Mat3 } from '@open-pencil/scene-graph/matrix'
import Matrix from '@open-pencil/scene-graph/matrix'

import { worldNodeVisualBounds } from '#core/canvas/renderer/visual-bounds'
import { nodeHasRadius, nodeHasSmoothCorners } from '#core/canvas/shapes'

export type RenderChunkKind = 'self' | 'subtree'

export interface RenderChunkContext {
  parentTransform: Mat3
  /**
   * The world box left by every clipping ancestor that is only translated and square-cornered,
   * the usual frame, so a record clips to it with one call; null when none clips so.
   */
  clipRect: VisualBounds | null
  /** Clipping ancestors that are rotated, flipped, scaled, or rounded, clipped under their matrix. */
  ancestorClipIds: string[]
}

export interface RenderChunk {
  id: string
  nodeId: string
  kind: RenderChunkKind
  context: RenderChunkContext
  interruptible: boolean
  /** Draw order across the page: the page child's position, then the order within its subtree. */
  painterOrder: number
  /** The page child whose subtree holds the chunk; a structural edit rebuilds that subtree alone. */
  topId: string
  localOrder: number
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

export const MAX_CHUNK_NODES = 32
/** Painter orders of one page child's chunks fit under those of the next. */
export const PAINTER_ORDER_SPAN = 2 ** 24

export function painterOrderOf(topIndex: number, localOrder: number): number {
  return topIndex * PAINTER_ORDER_SPAN + localOrder
}

export function nodeRequiresAtomicChunk(graph: SceneGraph, node: SceneNode): boolean {
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

export function shouldSplit(graph: SceneGraph, node: SceneNode, descendantCount: number): boolean {
  return (
    node.childIds.length > 0 &&
    descendantCount > MAX_CHUNK_NODES &&
    !nodeRequiresAtomicChunk(graph, node)
  )
}

export function estimateCost(nodeCount: number, node: SceneNode): number {
  const visibleEffects = node.effects.filter((effect) => effect.visible).length
  return nodeCount + visibleEffects * 8
}

export function subtreeBounds(graph: SceneGraph, nodeId: string) {
  return computeDescendantVisualBounds(
    [nodeId],
    (id) => graph.getNode(id),
    (id) => graph.getAbsolutePosition(id)
  )
}

/** One walk from the root composes the parent's transform and gathers the clips on the way. */
export function chunkContext(graph: SceneGraph, node: SceneNode): RenderChunkContext {
  const chain: SceneNode[] = []
  let parent = node.parentId ? graph.getNode(node.parentId) : undefined
  while (parent) {
    chain.push(parent)
    parent = parent.parentId ? graph.getNode(parent.parentId) : undefined
  }
  let matrix = Matrix.identity()
  let clipRect: VisualBounds | null = null
  const ancestorClipIds: string[] = []
  for (let index = chain.length - 1; index >= 0; index--) {
    const ancestor = chain[index]
    matrix = Matrix.multiply(matrix, getNodeLocalMatrix(ancestor))
    if (!ancestor.clipsContent) continue
    const translated = matrix[0] === 1 && matrix[1] === 0 && matrix[3] === 0 && matrix[4] === 1
    if (translated && !nodeHasRadius(ancestor) && !nodeHasSmoothCorners(ancestor)) {
      const box = {
        minX: matrix[2],
        minY: matrix[5],
        maxX: matrix[2] + ancestor.width,
        maxY: matrix[5] + ancestor.height
      }
      clipRect = clipRect
        ? {
            minX: Math.max(clipRect.minX, box.minX),
            minY: Math.max(clipRect.minY, box.minY),
            maxX: Math.min(clipRect.maxX, box.maxX),
            maxY: Math.min(clipRect.maxY, box.maxY)
          }
        : box
    } else {
      ancestorClipIds.push(ancestor.id)
    }
  }
  return { parentTransform: matrix, clipRect, ancestorClipIds }
}

export function countDescendants(graph: SceneGraph, nodeIds: string[]) {
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

/**
 * The chunks of `rootId`'s subtree in draw order, each numbered by `order` from its position in
 * that order; `topId` is the page child the subtree lies under.
 */
export function buildChunks(
  graph: SceneGraph,
  rootId: string,
  topId: string,
  topIndex: number,
  counts: Map<string, number>
) {
  const chunks: RenderChunk[] = []
  let position = 0
  const stack = [rootId]
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
        interruptible: split || !nodeRequiresAtomicChunk(graph, node),
        painterOrder: painterOrderOf(topIndex, position),
        topId,
        localOrder: position++,
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
