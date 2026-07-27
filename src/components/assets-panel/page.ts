import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

export function findAssetPage(node: SceneNode, graph: SceneGraph): SceneNode | null {
  let current: SceneNode | undefined = node
  while (current && current.type !== 'CANVAS') {
    current = current.parentId ? graph.getNode(current.parentId) : undefined
  }
  return current ?? null
}
