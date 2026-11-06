import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { layerDependencies } from '@open-pencil/scene-graph/transfer'

import { clipboardPlacement, type ClipboardPlacement } from './placement'
import { captureClipboardVariables, type ClipboardVariables } from './variables'

export type ClipboardNodeTree = SceneNode & { children?: ClipboardNodeTree[] }

export interface ClipboardSnapshot {
  sourceRootId: string
  componentDependencies: ClipboardNodeTree[]
  styleDefinitions: SceneNode[]
  variableDependencies: ClipboardVariables
  nodes: ClipboardNodeTree[]
  /** Where the copied layers sat on the canvas when they were copied. */
  placement: ClipboardPlacement
  images: Map<string, Uint8Array>
  /** Written by Copy properties: Paste skips it and Paste properties reads it, as in Figma. */
  properties?: boolean
}

export function captureClipboardSnapshot(
  graph: SceneGraph,
  selectedNodes: SceneNode[]
): ClipboardSnapshot {
  const selectedIds = new Set(selectedNodes.map((node) => node.id))
  const roots = selectedNodes.filter((node) => !node.parentId || !selectedIds.has(node.parentId))
  const capturedNodes: SceneNode[] = []
  function capture(node: SceneNode): ClipboardNodeTree {
    capturedNodes.push(node)
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
  const dependencies = layerDependencies(graph, capturedNodes)
  const images = new Map<string, Uint8Array>()
  for (const hash of dependencies.images) {
    const bytes = graph.images.get(hash)
    if (bytes) images.set(hash, bytes.slice())
  }
  return {
    sourceRootId: graph.rootId,
    componentDependencies: [...componentDependencies.values()],
    styleDefinitions: dependencies.styles.map((style) => structuredClone(style)),
    variableDependencies: captureClipboardVariables(graph, dependencies),
    nodes,
    placement: clipboardPlacement(graph, roots),
    images
  }
}
