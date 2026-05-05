import { SceneGraph } from '#core/scene-graph'
import type { SceneNode, Variable, VariableCollection, DocumentColorSpace } from '#core/scene-graph'

export interface SerializedSceneGraph {
  rootId: string
  nodes: Array<[string, SceneNode]>
  images: Array<[string, Uint8Array]>
  variables: Array<[string, Variable]>
  variableCollections: Array<[string, VariableCollection]>
  activeMode: Array<[string, string]>
  instanceIndex: Array<[string, string[]]>
  figKiwiVersion: number | null
  documentColorSpace: DocumentColorSpace
}

export function serializeSceneGraph(graph: SceneGraph): SerializedSceneGraph {
  return {
    rootId: graph.rootId,
    nodes: [...graph.nodes],
    images: [...graph.images],
    variables: [...graph.variables],
    variableCollections: [...graph.variableCollections],
    activeMode: [...graph.activeMode],
    instanceIndex: [...graph.instanceIndex].map(([id, nodeIds]) => [id, [...nodeIds]]),
    figKiwiVersion: graph.figKiwiVersion,
    documentColorSpace: graph.documentColorSpace
  }
}

export function deserializeSceneGraph(data: SerializedSceneGraph): SceneGraph {
  const graph = new SceneGraph()
  graph.rootId = data.rootId
  graph.nodes = new Map(data.nodes)
  graph.images = new Map(data.images)
  graph.variables = new Map(data.variables)
  graph.variableCollections = new Map(data.variableCollections)
  graph.activeMode = new Map(data.activeMode)
  graph.instanceIndex = new Map(data.instanceIndex.map(([id, nodeIds]) => [id, new Set(nodeIds)]))
  graph.figKiwiVersion = data.figKiwiVersion
  graph.documentColorSpace = data.documentColorSpace
  return graph
}
