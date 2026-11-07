import type { Effect, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getNodeLocalMatrix, getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import { unionVisualBounds, type VisualBounds } from '@open-pencil/scene-graph/geometry'
import Matrix, { type Mat3 } from '@open-pencil/scene-graph/matrix'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { projectedNode, type RotationPreview } from '#core/geometry'
import {
  localRenderBounds,
  mapVisualBounds,
  subtreeRenderBounds,
  type MeasuredSubtrees
} from '#core/geometry/render-bounds'

/** Where a node that draws nothing stands: its origin, as a box of no size. */
function origin(matrix: Mat3): VisualBounds {
  return mapVisualBounds(matrix, { minX: 0, minY: 0, maxX: 0, maxY: 0 })
}

/** What a node draws itself on the page, as far as the canvas draws its effects. */
export function worldNodeVisualBounds(graph: SceneGraph, node: SceneNode): VisualBounds {
  const matrix = getWorldMatrix(node, graph)
  const local = localRenderBounds(node, 'drawn')
  return local ? mapVisualBounds(matrix, local) : origin(matrix)
}

/**
 * What a node and its visible descendants draw, in the frame `toFrame` maps the node's own axes
 * into, as far as the canvas draws their effects (`subtreeRenderBounds`).
 */
export function subtreeVisualBounds(
  graph: SceneGraph,
  node: SceneNode,
  toFrame: Mat3,
  preview?: RotationPreview | null
): VisualBounds {
  return subtreeRenderBounds(graph, node, toFrame, { reach: 'drawn', preview }) ?? origin(toFrame)
}

/**
 * What the layers and their visible descendants draw, in page coordinates, as far as the canvas
 * draws their effects; null when none is visible.
 */
export function computeContentBounds(
  graph: SceneGraph,
  nodeIds: readonly string[]
): VisualBounds | null {
  let bounds: VisualBounds | null = null
  for (const nodeId of nodeIds) {
    const node = graph.getNode(nodeId)
    if (!node?.visible) continue
    bounds = unionVisualBounds(
      bounds,
      subtreeVisualBounds(graph, node, getWorldMatrix(node, graph))
    )
  }
  return bounds
}

function isAffine(matrix: Mat3): boolean {
  return matrix[6] === 0 && matrix[7] === 0 && matrix[8] === 1
}

/**
 * `mapVisualBounds` for the draw path, without its arrays: an affine map takes the box's centre
 * and grows it by how far the mapped half extents reach along each axis.
 */
export function mapLayerBounds(matrix: Mat3, bounds: VisualBounds): VisualBounds {
  if (!isAffine(matrix)) {
    return mapVisualBounds(matrix, bounds)
  }
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  const halfWidth = (bounds.maxX - bounds.minX) / 2
  const halfHeight = (bounds.maxY - bounds.minY) / 2
  const mappedX = matrix[0] * centerX + matrix[1] * centerY + matrix[2]
  const mappedY = matrix[3] * centerX + matrix[4] * centerY + matrix[5]
  const reachX = Math.abs(matrix[0]) * halfWidth + Math.abs(matrix[1]) * halfHeight
  const reachY = Math.abs(matrix[3]) * halfWidth + Math.abs(matrix[4]) * halfHeight
  return {
    minX: mappedX - reachX,
    minY: mappedY - reachY,
    maxX: mappedX + reachX,
    maxY: mappedY + reachY
  }
}

export function visibleLayerBlur(node: SceneNode): Effect | undefined {
  return node.effects.find(
    (effect) =>
      effect.visible && (effect.type === 'LAYER_BLUR' || effect.type === 'FOREGROUND_BLUR')
  )
}

type BoundsStore = Map<string, VisualBounds | null>

/**
 * The bounds a rotation preview changes, those of the turned layer's ancestors, kept apart for as
 * long as the same turn is previewed.
 */
interface PreviewedBounds {
  nodeId: string
  angle: number
  ancestorIds: Set<string>
  byNode: BoundsStore
}

interface GraphRenderedBounds {
  graph: SceneGraph
  generation: number
  byNode: BoundsStore
  previewed: PreviewedBounds | null
  unobserve: () => void
}

function ancestorIdsOf(graph: SceneGraph, nodeId: string): Set<string> {
  const ids = new Set<string>()
  let parentId = graph.getNode(nodeId)?.parentId
  while (parentId && !ids.has(parentId)) {
    ids.add(parentId)
    parentId = graph.getNode(parentId)?.parentId
  }
  return ids
}

/** Drops `nodeId`'s bounds and those of its ancestors, which hold them. */
function forgetIn(entry: GraphRenderedBounds, nodeId: string): void {
  for (const id of [nodeId, ...ancestorIdsOf(entry.graph, nodeId)]) {
    entry.byNode.delete(id)
    entry.previewed?.byNode.delete(id)
  }
}

const NOTHING_DRAWN: VisualBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 }

/**
 * Each node's rendered bounds in its own axes, kept per graph, a parent's made from its
 * children's. When the graph reports a node about to change, added, or previewed, that node and
 * its ancestors are measured again and the rest are kept; the renderer forgets a redrawn node and
 * its ancestors the same way, as when a text's fonts resolve, and everything on a new font
 * generation. A rotation preview turns one layer without telling the graph, and only its
 * ancestors' bounds hold that turn, so theirs are kept apart for the preview. A node object the
 * graph does not hold, such as a placeholder drawn in a layer's place, is measured apart from the
 * layer it shares an id with.
 */
export class RenderedBoundsCache {
  private readonly graphs = new WeakMap<SceneGraph, GraphRenderedBounds>()
  /** Held weakly, so a renderer that outlives the graphs it drew does not keep them alive. */
  private readonly observed = new Set<WeakRef<GraphRenderedBounds>>()
  private generation = 0

  ownAxes(graph: SceneGraph, node: SceneNode, preview?: RotationPreview | null): VisualBounds {
    if (graph.getNode(node.id) !== node) {
      return subtreeVisualBounds(graph, node, Matrix.identity(), preview)
    }
    const measured = this.measuredIn(graph, preview)
    let own = measured.get(node)
    if (own === undefined) {
      own = subtreeRenderBounds(graph, node, Matrix.identity(), {
        reach: 'drawn',
        preview,
        measured
      })
      measured.set(node, own)
    }
    return own ?? NOTHING_DRAWN
  }

  clear(): void {
    this.generation++
  }

  /** Forgets `nodeId`'s bounds and those of its ancestors, which hold them, in every graph. */
  forget(nodeId: string): void {
    for (const ref of this.observed) {
      const entry = ref.deref()
      if (entry) {
        forgetIn(entry, nodeId)
      }
    }
  }

  /** Stops watching every graph this cache has measured. */
  dispose(): void {
    for (const ref of this.observed) {
      ref.deref()?.unobserve()
    }
    this.observed.clear()
    this.generation++
  }

  private measuredIn(graph: SceneGraph, preview?: RotationPreview | null): MeasuredSubtrees {
    const entry = this.entryOf(graph)
    const previewed = preview ? this.previewedOf(graph, entry, preview) : null
    const storeOf = (node: SceneNode) =>
      previewed?.ancestorIds.has(node.id) ? previewed.byNode : entry.byNode
    return {
      get: (node) => storeOf(node).get(node.id),
      set: (node, bounds) => {
        storeOf(node).set(node.id, bounds)
      }
    }
  }

  private previewedOf(
    graph: SceneGraph,
    entry: GraphRenderedBounds,
    preview: RotationPreview
  ): PreviewedBounds {
    const current = entry.previewed
    if (current && current.nodeId === preview.nodeId && current.angle === preview.angle) {
      return current
    }
    const previewed: PreviewedBounds = {
      nodeId: preview.nodeId,
      angle: preview.angle,
      ancestorIds: ancestorIdsOf(graph, preview.nodeId),
      byNode: new Map()
    }
    entry.previewed = previewed
    return previewed
  }

  private entryOf(graph: SceneGraph): GraphRenderedBounds {
    const entry = this.graphs.get(graph) ?? this.watch(graph)
    if (entry.generation !== this.generation) {
      entry.byNode.clear()
      entry.previewed = null
      entry.generation = this.generation
    }
    return entry
  }

  private watch(graph: SceneGraph): GraphRenderedBounds {
    const entry: GraphRenderedBounds = {
      graph,
      generation: this.generation,
      byNode: new Map(),
      previewed: null,
      unobserve: () => undefined
    }
    const changed = (node: SceneNode) => {
      forgetIn(entry, node.id)
      entry.previewed = null
    }
    const previewed = (node: SceneNode) => {
      forgetIn(entry, node.id)
    }
    const unobserve = graph.observeNodeChanges({ before: changed, created: changed, previewed })
    entry.unobserve = () => {
      unobserve()
    }
    this.graphs.set(graph, entry)
    this.forgetCollectedGraphs()
    this.observed.add(new WeakRef(entry))
    return entry
  }

  private forgetCollectedGraphs(): void {
    for (const ref of this.observed) {
      if (!ref.deref()) {
        this.observed.delete(ref)
      }
    }
  }
}

function childMatrix(child: SceneNode, preview?: RotationPreview | null): Mat3 {
  return getNodeLocalMatrix(projectedNode(child, preview))
}

/** What a node and its visible descendants put on screen, in its parent's axes. */
export function subtreeVisualRectInParent(
  cache: RenderedBoundsCache,
  graph: SceneGraph,
  node: SceneNode,
  preview?: RotationPreview | null
): Rect {
  const bounds = mapLayerBounds(childMatrix(node, preview), cache.ownAxes(graph, node, preview))
  return {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY
  }
}
