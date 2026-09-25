import type { NodeType, SceneGraph, SceneNode } from '@open-pencil/core'

export function collectAllNodes(graph: SceneGraph): SceneNode[] {
  const all: SceneNode[] = []
  function walk(id: string) {
    const node = graph.getNode(id)
    if (!node) return
    all.push(node)
    for (const child of graph.getChildren(id)) {
      walk(child.id)
    }
  }
  for (const page of graph.getPages()) {
    for (const child of graph.getChildren(page.id)) {
      walk(child.id)
    }
  }
  return all
}

export function countByType(nodes: SceneNode[]): Map<NodeType, number> {
  const counts = new Map<NodeType, number>()
  for (const node of nodes) {
    counts.set(node.type, (counts.get(node.type) ?? 0) + 1)
  }
  return counts
}

export function childNamed(
  graph: SceneGraph,
  parent: SceneNode | undefined,
  name: string
): SceneNode | undefined {
  return parent ? graph.getChildren(parent.id).find((node) => node.name === name) : undefined
}

export function childMatching(
  graph: SceneGraph,
  parent: SceneNode | undefined,
  predicate: (node: SceneNode) => boolean
): SceneNode | undefined {
  return parent ? graph.getChildren(parent.id).find(predicate) : undefined
}

export function previewChild(
  graph: SceneGraph,
  nodes: SceneNode[],
  name: string
): SceneNode | undefined {
  const preview = nodes.find((node) => node.name === 'Preview Thumbnail')
  return childNamed(graph, preview, name)
}
