import { SceneGraph } from '@open-pencil/scene-graph'
import type { SceneNode } from '@open-pencil/scene-graph'

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
    manifest: structuredClone(revision.manifest),
    graph: {
      rootId: revision.graph.rootId,
      nodes: [...revision.graph.nodes].map(([id, node]) => [id, structuredClone(node)]),
      images: [...revision.graph.images].map(([hash, bytes]) => [hash, new Uint8Array(bytes)]),
      variables: [...revision.graph.variables].map(([id, variable]) => [
        id,
        structuredClone(variable)
      ]),
      variableCollections: [...revision.graph.variableCollections].map(([id, collection]) => [
        id,
        structuredClone(collection)
      ]),
      activeMode: [...revision.graph.activeMode],
      documentColorSpace: revision.graph.documentColorSpace
    }
  }
}

function cloneLibraryNode(node: SceneNode): SceneNode {
  const cloned = structuredClone(node)
  return Array.isArray(cloned.guides) ? cloned : { ...cloned, guides: [] }
}

export function deserializeLibraryRevision(
  revision: SerializedComponentLibraryRevision
): ComponentLibraryRevision {
  const graph = new SceneGraph()
  graph.rootId = revision.graph.rootId
  graph.nodes = new Map(revision.graph.nodes.map(([id, node]) => [id, cloneLibraryNode(node)]))
  graph.images = new Map(
    revision.graph.images.map(([hash, bytes]) => [hash, new Uint8Array(bytes)])
  )
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
  return { manifest: structuredClone(revision.manifest), graph }
}
