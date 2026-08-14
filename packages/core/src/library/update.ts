import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { findLibraryDefinition } from './definitions'
import { diffLibraryManifests } from './diff'
import type { ComponentLibraryRevision, LibraryAssetChange, LibraryAssetDescriptor } from './types'

export interface LibraryUpdateSummary {
  libraryId: string
  currentRevisionId: string
  latestRevisionId: string
  changes: LibraryAssetChange[]
}

export interface LibraryUpdateImpact {
  affectedInstanceCount: number
  fallbackInstanceCount: number
}

export interface LibraryInstanceUpdate {
  instanceId: string
  previousComponentId: string
  componentId: string
  fallback: boolean
}

function componentsForRoot(graph: SceneGraph, root: SceneNode): SceneNode[] {
  if (root.type === 'COMPONENT') return [root]
  if (root.type !== 'COMPONENT_SET') return []
  return root.childIds.flatMap((id) => {
    const child = graph.getNode(id)
    return child?.type === 'COMPONENT' ? [child] : []
  })
}

function sameVariant(left: SceneNode, right: SceneNode): boolean {
  const leftEntries = Object.entries(left.componentPropertyValues)
  return (
    leftEntries.length === Object.keys(right.componentPropertyValues).length &&
    leftEntries.every(([name, value]) => right.componentPropertyValues[name] === value)
  )
}

function topLeft(components: SceneNode[]): SceneNode | undefined {
  return [...components].sort(
    (left, right) => left.y - right.y || left.x - right.x || left.name.localeCompare(right.name)
  )[0]
}

export function summarizeLibraryUpdate(
  current: ComponentLibraryRevision,
  latest: ComponentLibraryRevision
): LibraryUpdateSummary | null {
  if (current.manifest.libraryId !== latest.manifest.libraryId) {
    throw new Error('Cannot compare revisions from different libraries')
  }
  if (current.manifest.revisionId === latest.manifest.revisionId) return null
  return {
    libraryId: current.manifest.libraryId,
    currentRevisionId: current.manifest.revisionId,
    latestRevisionId: latest.manifest.revisionId,
    changes: diffLibraryManifests(current.manifest, latest.manifest)
  }
}

export function libraryUpdateImpact(updates: LibraryInstanceUpdate[]): LibraryUpdateImpact {
  return {
    affectedInstanceCount: updates.length,
    fallbackInstanceCount: updates.filter((update) => update.fallback).length
  }
}

export function planLibraryInstanceUpdates(
  graph: SceneGraph,
  libraryId: string,
  previousRevisionId: string,
  nextRevisionId: string,
  descriptors: LibraryAssetDescriptor[]
): LibraryInstanceUpdate[] {
  const updates: LibraryInstanceUpdate[] = []
  for (const descriptor of descriptors) {
    const previousRoot = findLibraryDefinition(graph, libraryId, descriptor.key, previousRevisionId)
    const nextRoot = findLibraryDefinition(graph, libraryId, descriptor.key, nextRevisionId)
    if (!previousRoot || !nextRoot) continue
    const previousComponents = componentsForRoot(graph, previousRoot)
    const nextComponents = componentsForRoot(graph, nextRoot)
    const fallback = topLeft(nextComponents)
    if (!fallback) continue

    for (const previousComponent of previousComponents) {
      const target =
        nextComponents.find((component) => sameVariant(previousComponent, component)) ?? fallback
      for (const instance of graph.getInstances(previousComponent.id)) {
        updates.push({
          instanceId: instance.id,
          previousComponentId: previousComponent.id,
          componentId: target.id,
          fallback: !sameVariant(previousComponent, target)
        })
      }
    }
  }
  return updates
}
