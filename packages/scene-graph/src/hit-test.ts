import type { SceneGraph, SceneNode, NodeType } from './'
import { getWorldMatrix } from './coordinate'
import Matrix from './matrix'

const CONTAINER_TYPES = new Set<NodeType>([
  'CANVAS',
  'FRAME',
  'GROUP',
  'SECTION',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE'
])
const OPAQUE_CONTAINER_TYPES = new Set<NodeType>(['COMPONENT', 'INSTANCE'])

function hasVisibleFillOrStroke(node: SceneNode): boolean {
  return node.fills.some((f) => f.visible) || node.strokes.some((s) => s.visible)
}

function hasTransformedAncestor(
  node: SceneNode,
  graph: SceneGraph,
  cache: Map<string, boolean>
): boolean {
  const cached = cache.get(node.id)
  if (cached !== undefined) return cached
  const parent = node.parentId ? graph.getNode(node.parentId) : undefined
  const transformed =
    node.rotation !== 0 ||
    node.flipX ||
    node.flipY ||
    (parent ? hasTransformedAncestor(parent, graph, cache) : false)
  cache.set(node.id, transformed)
  return transformed
}

function containsPoint(
  px: number,
  py: number,
  node: SceneNode,
  graph: SceneGraph,
  transformCache: Map<string, boolean>
): boolean {
  if (!hasTransformedAncestor(node, graph, transformCache)) {
    const absolute = graph.getAbsolutePosition(node.id)
    return (
      px >= absolute.x &&
      px <= absolute.x + node.width &&
      py >= absolute.y &&
      py <= absolute.y + node.height
    )
  }

  const m = getWorldMatrix(node, graph)

  const inv = Matrix.invert(m)
  if (!inv) return false

  const [localX, localY] = Matrix.mapPoints(inv, [px, py])
  return localX >= 0 && localX <= node.width && localY >= 0 && localY <= node.height
}

function hitTestOpaqueContainer(
  graph: SceneGraph,
  px: number,
  py: number,
  child: SceneNode,
  childId: string,
  deep: boolean,
  transformCache: Map<string, boolean>
): SceneNode | null {
  if (!containsPoint(px, py, child, graph, transformCache)) return null
  const childHit = hitTestChildren(graph, px, py, childId, deep, transformCache)
  if (childHit) return child
  if (hasVisibleFillOrStroke(child)) return child
  return null
}
function hitTestTransparentContainer(
  graph: SceneGraph,
  px: number,
  py: number,
  child: SceneNode,
  childId: string,
  deep: boolean,
  transformCache: Map<string, boolean>
): SceneNode | null {
  if (child.type === 'GROUP') {
    if (!containsPoint(px, py, child, graph, transformCache)) return null

    if (deep) return hitTestChildren(graph, px, py, childId, deep, transformCache) ?? child

    return child
  }

  const childHit = hitTestChildren(graph, px, py, childId, deep, transformCache)
  if (childHit) {
    if (child.locked) return child
    return childHit
  }

  if (containsPoint(px, py, child, graph, transformCache) && hasVisibleFillOrStroke(child))
    return child
  return null
}

function hitTestChildren(
  graph: SceneGraph,
  px: number,
  py: number,
  parentId: string,
  deep = false,
  transformCache = new Map<string, boolean>()
): SceneNode | null {
  const parent = graph.nodes.get(parentId)
  if (!parent) return null

  if (parent.clipsContent) {
    if (!containsPoint(px, py, parent, graph, transformCache)) return null
  }

  for (let i = parent.childIds.length - 1; i >= 0; i--) {
    const childId = parent.childIds[i]
    const child = graph.nodes.get(childId)
    if (!child || child.internalOnly || !child.visible) continue
    if (CONTAINER_TYPES.has(child.type)) {
      if (OPAQUE_CONTAINER_TYPES.has(child.type) && !deep) {
        const hit = hitTestOpaqueContainer(graph, px, py, child, childId, deep, transformCache)
        if (hit) return hit
        continue
      }

      const hit = hitTestTransparentContainer(graph, px, py, child, childId, deep, transformCache)
      if (hit) return hit
      continue
    }

    if (containsPoint(px, py, child, graph, transformCache)) return child
  }

  return null
}

export function hitTest(
  graph: SceneGraph,
  px: number,
  py: number,
  scopeId?: string
): SceneNode | null {
  const scope = scopeId ?? graph.rootId
  return hitTestChildren(graph, px, py, scope, false)
}

export function hitTestDeep(
  graph: SceneGraph,
  px: number,
  py: number,
  scopeId?: string
): SceneNode | null {
  const scope = scopeId ?? graph.rootId
  return hitTestChildren(graph, px, py, scope, true)
}

/** Layers that take a dropped or drawn layer, as in Figma. */
const DROP_TARGET_TYPES = new Set<NodeType>(['FRAME', 'SECTION', 'COMPONENT', 'INSTANCE'])
/** Layers whose children can take a drop although they never take one themselves. */
const DROP_PASS_THROUGH_TYPES = new Set<NodeType>(['GROUP', 'COMPONENT_SET'])

function dropTargetIn(
  graph: SceneGraph,
  px: number,
  py: number,
  parent: SceneNode,
  excludeIds: ReadonlySet<string>,
  transformCache: Map<string, boolean>
): SceneNode | null {
  // A clipped-away part of a child is not under the cursor.
  if (
    parent.type !== 'CANVAS' &&
    parent.clipsContent &&
    !containsPoint(px, py, parent, graph, transformCache)
  )
    return null

  for (let i = parent.childIds.length - 1; i >= 0; i--) {
    const childId = parent.childIds[i]
    if (excludeIds.has(childId)) continue
    const child = graph.nodes.get(childId)
    if (!child || child.internalOnly || !child.visible || child.locked) continue
    const target = DROP_TARGET_TYPES.has(child.type)
    if (!target && !DROP_PASS_THROUGH_TYPES.has(child.type)) continue

    const deeper = dropTargetIn(graph, px, py, child, excludeIds, transformCache)
    if (deeper) return deeper
    if (target && containsPoint(px, py, child, graph, transformCache)) return child
  }

  return null
}

/**
 * The topmost unlocked frame, section, component, or instance under the point, in its rotated
 * shape and inside its clipping ancestors. Groups and component sets are looked through but never
 * returned; locked layers and their contents are skipped.
 */
export function hitTestDropTarget(
  graph: SceneGraph,
  px: number,
  py: number,
  excludeIds: ReadonlySet<string>,
  scopeId?: string
): SceneNode | null {
  const scope = graph.nodes.get(scopeId ?? graph.rootId)
  if (!scope) return null
  return dropTargetIn(graph, px, py, scope, excludeIds, new Map())
}
