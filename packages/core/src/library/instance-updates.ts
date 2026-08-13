import type { SceneGraph } from '@open-pencil/scene-graph'

import { findLibraryDefinition } from './definitions'
import type { ComponentLibraryRevision, LibraryAssetDescriptor } from './types'
import type { LibraryInstanceUpdate } from './update'

export function libraryAssetKeyForComponent(graph: SceneGraph, componentId: string): string | null {
  let node = graph.getNode(componentId)
  while (node) {
    const identity = node.librarySource?.identity
    if (identity) return identity.assetKey
    node = node.parentId ? graph.getNode(node.parentId) : undefined
  }
  return null
}

function targetComponentId(
  graph: SceneGraph,
  descriptor: LibraryAssetDescriptor,
  revision: ComponentLibraryRevision,
  previousComponentId: string
): { id: string; fallback: boolean } | null {
  const root = findLibraryDefinition(
    graph,
    revision.manifest.libraryId,
    descriptor.key,
    revision.manifest.revisionId
  )
  if (!root) return null
  const candidates =
    root.type === 'COMPONENT'
      ? [root]
      : graph.getChildren(root.id).filter((node) => node.type === 'COMPONENT')
  const previous = graph.getNode(previousComponentId)
  if (!previous) return null
  const exact = candidates.find((candidate) => {
    const entries = Object.entries(previous.componentPropertyValues)
    return (
      entries.length === Object.keys(candidate.componentPropertyValues).length &&
      entries.every(([name, value]) => candidate.componentPropertyValues[name] === value)
    )
  })
  if (candidates.length === 0) return null
  const fallback = [...candidates].sort((left, right) => left.y - right.y || left.x - right.x)[0]
  const target = exact ?? fallback
  return { id: target.id, fallback: !exact }
}

export function planOutdatedLibraryInstances(
  graph: SceneGraph,
  revision: ComponentLibraryRevision,
  assetKeys?: ReadonlySet<string>,
  instanceIds?: ReadonlySet<string>
): LibraryInstanceUpdate[] {
  const descriptors = new Map(revision.manifest.assets.map((asset) => [asset.key, asset]))
  const updates: LibraryInstanceUpdate[] = []
  for (const instance of graph.getAllNodes()) {
    if (instance.type !== 'INSTANCE' || !instance.componentId) continue
    if (instanceIds && !instanceIds.has(instance.id)) continue
    const component = graph.getNode(instance.componentId)
    const identity = component?.librarySource?.identity
    if (!identity || identity.libraryId !== revision.manifest.libraryId) continue
    const assetKey = libraryAssetKeyForComponent(graph, component.id)
    if (!assetKey || (assetKeys && !assetKeys.has(assetKey))) continue
    if (identity.revisionId === revision.manifest.revisionId) continue
    const descriptor = descriptors.get(assetKey)
    if (!descriptor) continue
    const target = targetComponentId(graph, descriptor, revision, component.id)
    if (!target) continue
    updates.push({
      instanceId: instance.id,
      previousComponentId: component.id,
      componentId: target.id,
      fallback: target.fallback
    })
  }
  return updates
}
