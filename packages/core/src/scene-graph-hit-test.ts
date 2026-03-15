import type { SceneGraph, SceneNode, NodeType } from './scene-graph'

const CONTAINER_TYPES = new Set<NodeType>([
  'CANVAS', 'FRAME', 'GROUP', 'SECTION', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE'
])
const OPAQUE_CONTAINER_TYPES = new Set<NodeType>(['COMPONENT', 'INSTANCE'])

function hasVisibleFillOrStroke(node: SceneNode): boolean {
  return node.fills.some((f) => f.visible) || node.strokes.some((s) => s.visible)
}

function containsPoint(px: number, py: number, ax: number, ay: number, node: SceneNode): boolean {
  return px >= ax && px <= ax + node.width && py >= ay && py <= ay + node.height
}

function hitTestOpaqueContainer(
  graph: SceneGraph,
  px: number,
  py: number,
  child: SceneNode,
  childId: string,
  ax: number,
  ay: number,
  deep: boolean
): SceneNode | null {
  if (!containsPoint(px, py, ax, ay, child)) return null
  const childHit = hitTestChildren(graph, px, py, childId, ax, ay, deep)
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
  ax: number,
  ay: number,
  deep: boolean
): SceneNode | null {
  const childHit = hitTestChildren(graph, px, py, childId, ax, ay, deep)
  if (childHit) {
    if (!deep && child.type === 'GROUP') return child
    if (child.locked) return child
    return childHit
  }
  if (child.type === 'GROUP') return null
  if (containsPoint(px, py, ax, ay, child) && hasVisibleFillOrStroke(child)) return child
  return null
}

function hitTestChildren(
  graph: SceneGraph,
  px: number,
  py: number,
  parentId: string,
  offsetX: number,
  offsetY: number,
  deep = false
): SceneNode | null {
  const parent = graph.nodes.get(parentId)
  if (!parent) return null

  if (parent.clipsContent) {
    if (!containsPoint(px, py, offsetX, offsetY, parent)) return null
  }

  for (let i = parent.childIds.length - 1; i >= 0; i--) {
    const childId = parent.childIds[i]
    const child = graph.nodes.get(childId)
    if (!child || !child.visible) continue

    const ax = offsetX + child.x
    const ay = offsetY + child.y

    if (CONTAINER_TYPES.has(child.type)) {
      if (OPAQUE_CONTAINER_TYPES.has(child.type) && !deep) {
        const hit = hitTestOpaqueContainer(graph, px, py, child, childId, ax, ay, deep)
        if (hit) return hit
        continue
      }

      const hit = hitTestTransparentContainer(graph, px, py, child, childId, ax, ay, deep)
      if (hit) return hit
      continue
    }

    if (containsPoint(px, py, ax, ay, child)) return child
  }
  return null
}

export function hitTest(graph: SceneGraph, px: number, py: number, scopeId?: string): SceneNode | null {
  const scope = scopeId ?? graph.rootId
  return hitTestChildren(graph, px, py, scope, 0, 0, false)
}

export function hitTestDeep(graph: SceneGraph, px: number, py: number, scopeId?: string): SceneNode | null {
  const scope = scopeId ?? graph.rootId
  return hitTestChildren(graph, px, py, scope, 0, 0, true)
}

function hitTestFrameChildren(
  graph: SceneGraph,
  px: number,
  py: number,
  parentId: string,
  offsetX: number,
  offsetY: number,
  excludeIds: Set<string>
): SceneNode | null {
  const parent = graph.nodes.get(parentId)
  if (!parent) return null

  let best: SceneNode | null = null

  for (const childId of parent.childIds) {
    if (excludeIds.has(childId)) continue
    const child = graph.nodes.get(childId)
    if (!child || !child.visible) continue

    const ax = offsetX + child.x
    const ay = offsetY + child.y

    if (!CONTAINER_TYPES.has(child.type)) continue
    if (px < ax || px > ax + child.width || py < ay || py > ay + child.height) continue

    best = child

    const deeper = hitTestFrameChildren(graph, px, py, childId, ax, ay, excludeIds)
    if (deeper) best = deeper
  }

  return best
}

export function hitTestFrame(
  graph: SceneGraph,
  px: number,
  py: number,
  excludeIds: Set<string>,
  scopeId?: string
): SceneNode | null {
  return hitTestFrameChildren(graph, px, py, scopeId ?? graph.rootId, 0, 0, excludeIds)
}
