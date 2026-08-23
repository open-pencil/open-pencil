import type { InstanceNodeChange } from '@open-pencil/fig/instance-overrides'
import { SceneGraph } from '@open-pencil/scene-graph'
import type { EnabledLibraryBinding, SceneNode } from '@open-pencil/scene-graph'

import { getLazyFigImportContext, setLazyFigImportContext } from '#core/kiwi/fig/lazy-import'
import type { PortableSceneGraphData } from '#core/kiwi/fig/parse/portable-data'

export interface SerializedLazyFigImportContext {
  changeMap: Array<[string, InstanceNodeChange]>
  guidToNodeId: Array<[string, string]>
  blobs: Uint8Array[]
  populatedRootIds: string[]
}

export interface SerializedSceneGraph extends PortableSceneGraphData {
  instanceIndex: Array<[string, string[]]>
  figKiwiVersion: number | null
  figSchemaDeflated: Uint8Array | null
  enabledLibraries?: Array<[string, EnabledLibraryBinding]>
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
    figSchemaDeflated: graph.figSchemaDeflated,
    documentColorSpace: graph.documentColorSpace,
    enabledLibraries: [...graph.enabledLibraries],
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
  if (data.figSchemaDeflated) {
    if (
      data.figSchemaDeflated.buffer instanceof ArrayBuffer &&
      data.figSchemaDeflated.byteOffset === 0 &&
      data.figSchemaDeflated.byteLength === data.figSchemaDeflated.buffer.byteLength
    ) {
      buffers.add(data.figSchemaDeflated.buffer)
    }
  }
  return [...buffers]
}

/**
 * Clone the graph state that lazy FIG population may mutate while retaining immutable imported
 * resources by reference. Population replaces node fields and mutates child ID arrays, but only
 * reads image bytes, variables, source changes, GUID mappings, blobs, and schema bytes.
 */
export function cloneSceneGraphForFigExport(graph: SceneGraph): SceneGraph {
  const cloned = new SceneGraph()
  cloned.rootId = graph.rootId
  cloned.nodes = new Map(
    [...graph.nodes].map(([id, node]) => [id, { ...node, childIds: [...node.childIds] }])
  )
  cloned.images = new Map(graph.images)
  cloned.variables = new Map(graph.variables)
  cloned.variableCollections = new Map(graph.variableCollections)
  cloned.activeMode = new Map(graph.activeMode)
  cloned.instanceIndex = new Map(
    [...graph.instanceIndex].map(([id, nodeIds]) => [id, new Set(nodeIds)])
  )
  cloned.figKiwiVersion = graph.figKiwiVersion
  cloned.figSchemaDeflated = graph.figSchemaDeflated
  cloned.documentColorSpace = graph.documentColorSpace
  cloned.enabledLibraries = new Map(graph.enabledLibraries)

  const lazyFigImport = getLazyFigImportContext(graph)
  if (lazyFigImport) {
    setLazyFigImportContext(cloned, {
      changeMap: lazyFigImport.changeMap,
      guidToNodeId: lazyFigImport.guidToNodeId,
      blobs: lazyFigImport.blobs,
      populatedRootIds: new Set(lazyFigImport.populatedRootIds)
    })
  }
  return cloned
}

function normalizeNodeGuides(node: SceneNode): SceneNode {
  return Array.isArray(node.guides) ? node : { ...node, guides: [] }
}

export function deserializeSceneGraph(data: SerializedSceneGraph): SceneGraph {
  const graph = new SceneGraph()
  graph.rootId = data.rootId
  graph.nodes = new Map(data.nodes.map(([id, node]) => [id, normalizeNodeGuides(node)]))
  graph.images = new Map(data.images)
  graph.variables = new Map(data.variables)
  graph.variableCollections = new Map(data.variableCollections)
  graph.activeMode = new Map(data.activeMode)
  graph.instanceIndex = new Map(data.instanceIndex.map(([id, nodeIds]) => [id, new Set(nodeIds)]))
  graph.figKiwiVersion = data.figKiwiVersion
  graph.figSchemaDeflated = data.figSchemaDeflated
  graph.documentColorSpace = data.documentColorSpace
  graph.enabledLibraries = data.enabledLibraries ? new Map(data.enabledLibraries) : new Map()
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
