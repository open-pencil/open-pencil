import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { localTransformFromWorld } from '@open-pencil/scene-graph/coordinate'
import { fitEnclosingGroups } from '@open-pencil/scene-graph/group-bounds'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Vector } from '@open-pencil/scene-graph/primitives'

/**
 * Where pen.dev puts a layer: at `x`, `y` in its parent, turned `rotation` degrees
 * counter-clockwise and then mirrored, both about that corner. The scene graph turns clockwise and
 * mirrors about a layer's centre, so a layer's position depends on its final size and is set after
 * layout. Measured against pen.dev 2.21 renders of turned, mirrored, and grouped layers.
 */
export interface PenPlacement {
  x: number
  y: number
  rotation: number
  flipX: boolean
  flipY: boolean
}

export function isPlain(placement: PenPlacement): boolean {
  return placement.rotation === 0 && !placement.flipX && !placement.flipY
}

function inFlow(graph: SceneGraph, node: SceneNode): boolean {
  const parent = node.parentId ? graph.getNode(node.parentId) : undefined
  return !!parent && parent.layoutMode !== 'NONE' && node.layoutPositioning !== 'ABSOLUTE'
}

/** Sets a layer's position and turn so it lands where pen.dev draws it; `offset` is where its box starts in pen.dev's. */
function place(
  graph: SceneGraph,
  node: SceneNode,
  placement: PenPlacement,
  offset: Vector = { x: 0, y: 0 }
) {
  const world = Matrix.multiply(
    Matrix.translated(placement.x, placement.y),
    Matrix.rotated((-placement.rotation * Math.PI) / 180),
    Matrix.scaled(placement.flipX ? -1 : 1, placement.flipY ? -1 : 1),
    Matrix.translated(offset.x, offset.y)
  )
  const local = localTransformFromWorld(
    { ...node, flipX: placement.flipX },
    world,
    Matrix.identity()
  )
  if (!local) return
  // Auto layout places the layers in its flow; only their turn and mirroring carry over.
  if (inFlow(graph, node)) graph.updateNode(node.id, { ...local, x: node.x, y: node.y })
  else graph.updateNode(node.id, local)
}

/**
 * Places every turned or mirrored layer, which the reader builds upright. Then each group, inner
 * ones first, is fitted to its placed layers and placed itself; its box starts at its layers'
 * bounds, wherever pen.dev's starts. `groupIds` is in reading order.
 */
export function placeLayers(
  graph: SceneGraph,
  placements: ReadonlyMap<string, PenPlacement>,
  groupIds: readonly string[]
): void {
  const groups = new Set(groupIds)
  for (const [id, placement] of placements) {
    const node = graph.getNode(id)
    if (node && !groups.has(id) && !isPlain(placement)) place(graph, node, placement)
  }

  const origins = new Map<string, Vector>()
  for (const id of groupIds) {
    const group = graph.getNode(id)
    if (group) origins.set(id, { x: group.x, y: group.y })
  }
  // Reading order lists a group before the groups inside it, so reversed it is innermost first.
  for (const id of groupIds.toReversed()) {
    fitEnclosingGroups(graph, [id])
    const node = graph.getNode(id)
    const origin = origins.get(id)
    const placement = placements.get(id)
    if (!node || !origin || !placement || isPlain(placement)) continue
    place(graph, node, placement, { x: node.x - origin.x, y: node.y - origin.y })
  }
}
