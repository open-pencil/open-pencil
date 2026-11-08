import { getNodeLocalMatrix } from '../coordinate'
import type { SceneGraph } from '../graph'
import { groupFitChanges } from '../group-bounds'
import { enforcedAspectRatio } from '../layout/aspect-ratio'
import Matrix, { type Mat3 } from '../matrix'
import { FITTED_CONTAINER_TYPES } from '../node-defaults'
import { constrainedChildRect, flipChanges } from '../resize'
import type { SceneNode } from '../types'

/** The fields that say where a copy sits in its parent, and which way its constraints turned it. */
export const PLACEMENT_FIELDS: ReadonlySet<string> = new Set([
  'x',
  'y',
  'width',
  'height',
  'flipX',
  'flipY'
])

/** The frame around the groups and booleans holding a layer, and their space mapped into its. */
function frameAround(
  graph: SceneGraph,
  parent: SceneNode
): { frame: SceneNode; toFrame: Mat3 } | null {
  let toFrame = Matrix.identity()
  let node = parent
  while (FITTED_CONTAINER_TYPES.has(node.type)) {
    toFrame = Matrix.multiply(getNodeLocalMatrix(node), toFrame)
    const next = node.parentId ? graph.getNode(node.parentId) : undefined
    if (!next) return null
    node = next
  }
  return { frame: node, toFrame }
}

/**
 * The component's layer placed in the copy's parent: where its constraints put it when the
 * instance's frame has another size than the component's, as Figma resizes an instance. A group
 * or boolean owns no constraints: it keeps the component's place, and a layer in it is placed in
 * the frame around it and written back in the copy's group, which `fitCopiedGroup` then fits.
 */
export function placedByConstraints(
  graph: SceneGraph,
  source: SceneNode,
  compParent: SceneNode,
  instParent: SceneNode,
  factor: number
): SceneNode {
  if (FITTED_CONTAINER_TYPES.has(source.type)) return source
  const comp = frameAround(graph, compParent)
  const inst = frameAround(graph, instParent)
  if (!comp || !inst) return source
  const before = { width: comp.frame.width * factor, height: comp.frame.height * factor }
  if (before.width === inst.frame.width && before.height === inst.frame.height) return source
  // `source` is at the copy's scale, so the component's groups map it at that scale too.
  const toFrame = Matrix.multiply(
    Matrix.scaled(factor, factor),
    Matrix.multiply(comp.toFrame, Matrix.scaled(1 / factor, 1 / factor))
  )
  const { flipsX, flipsY, ...box } = constrainedChildRect(
    { ...Matrix.mapPoint(toFrame, source), width: source.width, height: source.height },
    before,
    inst.frame,
    source.horizontalConstraint,
    source.verticalConstraint,
    enforcedAspectRatio(source)
  )
  const back = Matrix.invert(inst.toFrame)
  const position = back ? Matrix.mapPoint(back, box) : box
  return { ...source, ...box, ...position, ...flipChanges(source, source, flipsX, flipsY) }
}

/** Fits a copied group or boolean to its layers after the sync placed them by their constraints. */
export function fitCopiedGroup(graph: SceneGraph, groupId: string): void {
  const group = graph.getNode(groupId)
  if (!group || !FITTED_CONTAINER_TYPES.has(group.type)) return
  const changes = groupFitChanges(graph, group, graph.getChildren(groupId))
  for (const [id, change] of changes ?? []) graph.updateNode(id, change)
}
