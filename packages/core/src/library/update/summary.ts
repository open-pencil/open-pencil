import type { SceneGraph } from '@open-pencil/scene-graph'

import { findLibraryDefinition } from '#core/library/definitions'
import { diffLibraryManifests } from '#core/library/diff'
import type {
  ComponentLibraryRevision,
  LibraryAssetChange,
  LibraryAssetDescriptor
} from '#core/library/types'
import { assetComponent, assetComponents } from '#core/library/variants'

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

    for (const previousComponent of assetComponents(graph, previousRoot)) {
      const target = assetComponent(graph, nextRoot, previousComponent)
      if (!target) continue
      for (const instance of graph.getInstances(previousComponent.id)) {
        updates.push({
          instanceId: instance.id,
          previousComponentId: previousComponent.id,
          componentId: target.component.id,
          fallback: target.fallback
        })
      }
    }
  }
  return updates
}
