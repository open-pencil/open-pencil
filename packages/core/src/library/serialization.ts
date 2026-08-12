import { SceneGraph } from '@open-pencil/scene-graph'

import type { PortableSceneGraphData } from '#core/kiwi/fig/parse/portable-data'

import type { ComponentLibraryManifest, ComponentLibraryRevision } from './types'

export type SerializedLibraryGraph = PortableSceneGraphData

export interface SerializedComponentLibraryRevision {
  manifest: ComponentLibraryManifest
  graph: SerializedLibraryGraph
}

export function serializeLibraryRevision(
  revision: ComponentLibraryRevision
): SerializedComponentLibraryRevision {
  return {
    manifest: revision.manifest,
    graph: {
      rootId: revision.graph.rootId,
      nodes: [...revision.graph.nodes],
      images: [...revision.graph.images],
      variables: [...revision.graph.variables],
      variableCollections: [...revision.graph.variableCollections],
      activeMode: [...revision.graph.activeMode],
      documentColorSpace: revision.graph.documentColorSpace
    }
  }
}

export function deserializeLibraryRevision(
  revision: SerializedComponentLibraryRevision
): ComponentLibraryRevision {
  const graph = new SceneGraph()
  graph.rootId = revision.graph.rootId
  graph.nodes = new Map(revision.graph.nodes)
  graph.images = new Map(revision.graph.images)
  graph.variables = new Map(revision.graph.variables)
  graph.variableCollections = new Map(revision.graph.variableCollections)
  graph.activeMode = new Map(revision.graph.activeMode)
  graph.documentColorSpace = revision.graph.documentColorSpace
  graph.instanceIndex = new Map()
  for (const node of graph.getAllNodes()) {
    if (!node.componentId) continue
    const instances = graph.instanceIndex.get(node.componentId) ?? new Set<string>()
    instances.add(node.id)
    graph.instanceIndex.set(node.componentId, instances)
  }
  return { manifest: revision.manifest, graph }
}
