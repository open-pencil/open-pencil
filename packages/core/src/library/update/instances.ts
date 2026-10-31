import type { LibraryAssetIdentity, SceneGraph } from '@open-pencil/scene-graph'

import { findLibraryDefinition } from '#core/library/definitions'
import type { ComponentLibraryRevision, LibraryAssetDescriptor } from '#core/library/types'
import { assetComponent } from '#core/library/variants'

import type { LibraryInstanceUpdate } from './summary'

/**
 * The library asset a component belongs to: a variant's, keyed or not, is its set's, and any other
 * component's its own, as a library publishes each component outside a set as an asset.
 */
export function libraryIdentityForComponent(
  graph: SceneGraph,
  componentId: string
): LibraryAssetIdentity | null {
  const component = graph.getNode(componentId)
  const parent = component?.parentId ? graph.getNode(component.parentId) : undefined
  const set = parent?.type === 'COMPONENT_SET' ? parent.librarySource?.identity : undefined
  return set ?? component?.librarySource?.identity ?? null
}

export function libraryAssetKeyForComponent(graph: SceneGraph, componentId: string): string | null {
  return libraryIdentityForComponent(graph, componentId)?.assetKey ?? null
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
  const previous = graph.getNode(previousComponentId)
  const target = root && previous ? assetComponent(graph, root, previous) : undefined
  return target ? { id: target.component.id, fallback: target.fallback } : null
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
    const identity = component ? libraryIdentityForComponent(graph, component.id) : null
    if (!component || identity?.libraryId !== revision.manifest.libraryId) continue
    const { assetKey } = identity
    if (assetKeys && !assetKeys.has(assetKey)) continue
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
