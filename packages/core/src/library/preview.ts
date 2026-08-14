import { cloneNodeProps, SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import { reapplyInstanceComponentProperties } from '#core/editor/components/properties'

import { libraryAssetKeyForComponent } from './instance-updates'
import { libraryDependencyRoots } from './materialize'
import type { ComponentLibraryRevision } from './types'

export interface LibraryUpdatePreview {
  graph: SceneGraph
  currentNodeId: string
  updatedNodeId: string
  fallback: boolean
}

function copyPreviewDefinitions(
  source: SceneGraph,
  target: SceneGraph,
  components: SceneNode[],
  pageId: string
): Map<string, string> {
  const mapped = new Map<string, string>()
  const copy = (node: SceneNode, parentId: string): string => {
    const existing = mapped.get(node.id)
    if (existing) return existing
    const created = target.createNode(node.type, parentId, cloneNodeProps(node, node.componentId))
    mapped.set(node.id, created.id)
    for (const child of source.getChildren(node.id)) copy(child, created.id)
    return created.id
  }
  for (const component of components) copy(component, pageId)
  for (const [sourceId, targetId] of mapped) {
    const componentId = source.getNode(sourceId)?.componentId
    const remapped = componentId ? mapped.get(componentId) : null
    if (remapped) target.updateNode(targetId, { componentId: remapped })
  }
  return mapped
}

function consumerDependencyRoots(graph: SceneGraph, component: SceneNode): SceneNode[] {
  const roots = new Map([[component.id, component]])
  const visited = new Set<string>()
  const pending = [component.id]
  while (pending.length > 0) {
    const id = pending.pop()
    if (!id || visited.has(id)) continue
    visited.add(id)
    const node = graph.getNode(id)
    if (!node) continue
    pending.push(...node.childIds)
    if (!node.componentId) continue
    const dependency = graph.getNode(node.componentId)
    if (!dependency) continue
    const parent = dependency.parentId ? graph.getNode(dependency.parentId) : undefined
    const root = parent?.type === 'COMPONENT_SET' ? parent : dependency
    roots.set(root.id, root)
    pending.push(root.id)
  }
  return [...roots.values()]
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

function propertyDefinitions(graph: SceneGraph, component: SceneNode) {
  const parent = component.parentId ? graph.getNode(component.parentId) : null
  return [
    ...(parent?.type === 'COMPONENT_SET' ? parent.componentPropertyDefinitions : []),
    ...component.componentPropertyDefinitions
  ]
}

function createPreviewInstance(
  graph: SceneGraph,
  pageId: string,
  componentId: string,
  source: SceneNode
): string {
  const instance = graph.createInstance(componentId, pageId, {
    ...cloneNodeProps(source, componentId),
    componentId,
    x: 0,
    y: 0
  })
  if (!instance) throw new Error('Preview instance could not be created')
  return instance.id
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
  const latestRoots = latest.manifest.assets.flatMap((descriptor) =>
    libraryDependencyRoots(latest, descriptor)
  )
  const currentRoots = consumerDependencyRoots(consumer, currentComponent)
  const currentMapped = copyPreviewDefinitions(consumer, graph, currentRoots, page.id)
  const currentComponentId = currentMapped.get(currentComponent.id)
  if (!currentComponentId) throw new Error('Current preview definition could not be copied')
  const latestMapped = copyPreviewDefinitions(latest.graph, graph, latestRoots, page.id)
  const updatedComponentId = latestMapped.get(updatedComponent.id)
  if (!updatedComponentId) throw new Error('Updated preview definition could not be copied')
  graph.updateNode(currentComponentId, {
    componentPropertyDefinitions: propertyDefinitions(consumer, currentComponent)
  })
  graph.updateNode(updatedComponentId, {
    componentPropertyDefinitions: propertyDefinitions(latest.graph, updatedComponent)
  })
  const currentNodeId = createPreviewInstance(graph, page.id, currentComponentId, instance)
  const updatedNodeId = createPreviewInstance(graph, page.id, updatedComponentId, instance)
  reapplyInstanceComponentProperties({ graph }, currentNodeId)
  reapplyInstanceComponentProperties({ graph }, updatedNodeId)
  graph.updateNode(currentComponentId, { internalOnly: true })
  graph.updateNode(updatedComponentId, { internalOnly: true })
  return { graph, currentNodeId, updatedNodeId, fallback: !exact }
}
