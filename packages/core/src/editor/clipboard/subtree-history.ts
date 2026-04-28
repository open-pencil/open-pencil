import type { SceneGraph, SceneNode } from '#core/scene-graph'

export function collectSubtrees(graph: SceneGraph, rootIds: string[]): SceneNode[] {
  const result: SceneNode[] = []
  function walk(id: string) {
    const node = graph.getNode(id)
    if (!node) return
    result.push({ ...node })
    for (const childId of node.childIds) walk(childId)
  }
  for (const id of rootIds) walk(id)
  return result
}

export function snapshotSubtree(graph: SceneGraph, rootId: string): Map<string, SceneNode> {
  const index = new Map<string, SceneNode>()
  const walk = (id: string) => {
    const node = graph.getNode(id)
    if (!node) return
    index.set(id, structuredClone(node))
    for (const childId of node.childIds) walk(childId)
  }
  walk(rootId)
  return index
}

export function restoreSubtree(
  graph: SceneGraph,
  snapshot: SceneNode,
  parentId: string,
  index: Map<string, SceneNode>
): void {
  const { parentId: _parentId, childIds, ...rest } = snapshot
  graph.createNode(snapshot.type, parentId, { ...rest, id: snapshot.id })
  for (const childId of childIds) {
    const child = index.get(childId)
    if (child) restoreSubtree(graph, child, snapshot.id, index)
  }
}
