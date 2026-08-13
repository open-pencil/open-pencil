import { cloneNodeProps, SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import { libraryAssetKeyForComponent } from './instance-updates'
import type { ComponentLibraryRevision } from './types'

export interface LibraryUpdatePreview {
  graph: SceneGraph
  currentNodeId: string
  updatedNodeId: string
  fallback: boolean
}

function copyTree(
  source: SceneGraph,
  target: SceneGraph,
  node: SceneNode,
  parentId: string
): string {
  const created = target.createNode(node.type, parentId, cloneNodeProps(node, node.componentId))
  for (const child of source.getChildren(node.id)) copyTree(source, target, child, created.id)
  return created.id
}

function revisionComponents(revision: ComponentLibraryRevision, assetKey: string): SceneNode[] {
  const descriptor = revision.manifest.assets.find((asset) => asset.key === assetKey)
  const root = descriptor ? revision.graph.getNode(descriptor.sourceNodeId) : null
  if (!root) return []
  return root.type === 'COMPONENT'
    ? [root]
    : revision.graph.getChildren(root.id).filter((node) => node.type === 'COMPONENT')
}

function sameVariant(left: SceneNode, right: SceneNode): boolean {
  const entries = Object.entries(left.componentPropertyValues)
  return (
    entries.length === Object.keys(right.componentPropertyValues).length &&
    entries.every(([name, value]) => right.componentPropertyValues[name] === value)
  )
}

export function createLibraryUpdatePreview(
  consumer: SceneGraph,
  instanceId: string,
  latest: ComponentLibraryRevision
): LibraryUpdatePreview {
  const instance = consumer.getNode(instanceId)
  if (instance?.type !== 'INSTANCE' || !instance.componentId)
    throw new Error('Linked instance not found')
  const currentComponent = consumer.getNode(instance.componentId)
  if (!currentComponent) throw new Error('Linked component not found')
  const assetKey = libraryAssetKeyForComponent(consumer, currentComponent.id)
  if (!assetKey) throw new Error('Linked library asset not found')
  const candidates = revisionComponents(latest, assetKey)
  const exact = candidates.find((candidate) => sameVariant(currentComponent, candidate))
  if (candidates.length === 0) throw new Error('Updated library component not found')
  const fallback = [...candidates].sort((left, right) => left.y - right.y || left.x - right.x)[0]
  const updatedComponent = exact ?? fallback

  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const currentNodeId = copyTree(consumer, graph, currentComponent, page.id)
  const updatedNodeId = copyTree(latest.graph, graph, updatedComponent, page.id)
  graph.updateNode(currentNodeId, { x: 0, y: 0 })
  graph.updateNode(updatedNodeId, { x: 0, y: 0 })
  return { graph, currentNodeId, updatedNodeId, fallback: !exact }
}
