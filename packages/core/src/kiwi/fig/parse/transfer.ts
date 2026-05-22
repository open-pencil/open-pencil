import type { InstanceNodeChange } from '#core/kiwi/fig/instance-overrides'
import { getLazyFigImportContext, setLazyFigImportContext } from '#core/kiwi/fig/lazy-import'
import { SceneGraph } from '#core/scene-graph'
import type { SceneNode, Variable, VariableCollection, DocumentColorSpace } from '#core/scene-graph'

export interface SerializedLazyFigImportContext {
  changeMap: Array<[string, InstanceNodeChange]>
  guidToNodeId: Array<[string, string]>
  blobs: Uint8Array[]
  populatedRootIds: string[]
}

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
  lazyFigImport?: SerializedLazyFigImportContext
}

export function serializeSceneGraph(graph: SceneGraph): SerializedSceneGraph {
  const lazyFigImport = getLazyFigImportContext(graph)
  return {
    rootId: graph.rootId,
    nodes: [...graph.nodes],
    images: [...graph.images],
    variables: [...graph.variables],
    variableCollections: [...graph.variableCollections],
    activeMode: [...graph.activeMode],
    instanceIndex: [...graph.instanceIndex].map(([id, nodeIds]) => [id, [...nodeIds]]),
    figKiwiVersion: graph.figKiwiVersion,
    documentColorSpace: graph.documentColorSpace,
    lazyFigImport: lazyFigImport
      ? {
          changeMap: [...lazyFigImport.changeMap],
          guidToNodeId: [...lazyFigImport.guidToNodeId],
          blobs: lazyFigImport.blobs,
          populatedRootIds: [...lazyFigImport.populatedRootIds]
        }
      : undefined
  }
}

export function serializedSceneGraphTransferList(data: SerializedSceneGraph): Transferable[] {
  const buffers = new Set<ArrayBuffer>()
  for (const [, image] of data.images) {
    if (
      image.buffer instanceof ArrayBuffer &&
      image.byteOffset === 0 &&
      image.byteLength === image.buffer.byteLength
    ) {
      buffers.add(image.buffer)
    }
  }
  for (const blob of data.lazyFigImport?.blobs ?? []) {
    if (
      blob.buffer instanceof ArrayBuffer &&
      blob.byteOffset === 0 &&
      blob.byteLength === blob.buffer.byteLength
    ) {
      buffers.add(blob.buffer)
    }
  }
  return [...buffers]
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
  if (data.lazyFigImport) {
    setLazyFigImportContext(graph, {
      changeMap: new Map(data.lazyFigImport.changeMap),
      guidToNodeId: new Map(data.lazyFigImport.guidToNodeId),
      blobs: data.lazyFigImport.blobs,
      populatedRootIds: new Set(data.lazyFigImport.populatedRootIds)
    })
  }
  return graph
}
