import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { captureClipboardVariables, type ClipboardVariables } from './variables'

export type ClipboardNodeTree = SceneNode & { children?: ClipboardNodeTree[] }

export interface ClipboardSnapshot {
  sourceRootId: string
  componentDependencies: ClipboardNodeTree[]
  styleDefinitions: SceneNode[]
  variableDependencies: ClipboardVariables
  nodes: ClipboardNodeTree[]
  images: Map<string, Uint8Array>
}

function referencedStyleIds(nodes: SceneNode[]): Set<string> {
  const ids = new Set<string>()
  for (const node of nodes) {
    for (const id of [
      node.fillStyleId,
      node.strokeStyleId,
      node.textStyleId,
      node.effectStyleId,
      node.gridStyleId
    ]) {
      if (id) ids.add(id)
    }
  }
  return ids
}

export function captureClipboardSnapshot(
  graph: SceneGraph,
  selectedNodes: SceneNode[]
): ClipboardSnapshot {
  const selectedIds = new Set(selectedNodes.map((node) => node.id))
  const roots = selectedNodes.filter((node) => !node.parentId || !selectedIds.has(node.parentId))
  const images = new Map<string, Uint8Array>()
  const capturedNodes: SceneNode[] = []
  function capture(node: SceneNode): ClipboardNodeTree {
    capturedNodes.push(node)
    for (const paint of node.fills) {
      if (!paint.imageHash) continue
      const bytes = graph.images.get(paint.imageHash)
      if (bytes) images.set(paint.imageHash, bytes.slice())
    }
    return { ...structuredClone(node), children: graph.getChildren(node.id).map(capture) }
  }
  const nodes = roots.map(capture)
  const componentDependencies = new Map<string, ClipboardNodeTree>()
  function captureComponent(id: string) {
    if (componentDependencies.has(id) || selectedIds.has(id)) return
    const component = graph.getNode(id)
    if (!component || (component.type !== 'COMPONENT' && component.type !== 'COMPONENT_SET')) return
    const tree = capture(component)
    componentDependencies.set(id, tree)
    visitReferences(tree)
  }
  function visitReferences(node: ClipboardNodeTree) {
    if (node.componentId) captureComponent(node.componentId)
    for (const child of node.children ?? []) visitReferences(child)
  }
  for (const node of nodes) visitReferences(node)
  const styleIds = referencedStyleIds(capturedNodes)
  const styleDefinitions: SceneNode[] = []
  for (const node of graph.getAllNodes()) {
    if (node.source.id && styleIds.has(node.source.id)) styleDefinitions.push(structuredClone(node))
  }
  return {
    sourceRootId: graph.rootId,
    componentDependencies: [...componentDependencies.values()],
    styleDefinitions,
    variableDependencies: captureClipboardVariables(graph, capturedNodes),
    nodes,
    images
  }
}
