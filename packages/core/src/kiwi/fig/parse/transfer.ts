import { SceneGraph } from '@open-pencil/scene-graph'
import type { EnabledLibraryBinding, SceneNode } from '@open-pencil/scene-graph'

import type { PortableSceneGraphData } from '#core/kiwi/fig/parse/portable-data'

export interface SerializedSceneGraph extends PortableSceneGraphData {
  instanceIndex: Array<[string, string[]]>
  figKiwiVersion: number | null
  figSchemaDeflated: Uint8Array | null
  enabledLibraries?: Array<[string, EnabledLibraryBinding]>
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
    figSchemaDeflated: graph.figSchemaDeflated,
    documentColorSpace: graph.documentColorSpace,
    enabledLibraries: [...graph.enabledLibraries]
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

  return cloned
}

function normalizeImportedNode(
  node: Omit<SceneNode, 'componentScale'> & { componentScale?: number }
): SceneNode {
  return {
    ...node,
    guides: Array.isArray(node.guides) ? node.guides : [],
    variableBindingScales: { ...node.variableBindingScales },
    variableAssignmentScales: { ...node.variableAssignmentScales },
    componentScale: node.componentScale ?? 1
  }
}

export function deserializeSceneGraph(data: SerializedSceneGraph): SceneGraph {
  const graph = new SceneGraph()
  graph.rootId = data.rootId
  graph.nodes = new Map(data.nodes.map(([id, node]) => [id, normalizeImportedNode(node)]))
  graph.images = new Map(data.images)
  graph.variables = new Map(data.variables)
  graph.variableCollections = new Map(data.variableCollections)
  graph.activeMode = new Map(data.activeMode)
  graph.instanceIndex = new Map(data.instanceIndex.map(([id, nodeIds]) => [id, new Set(nodeIds)]))
  graph.figKiwiVersion = data.figKiwiVersion
  graph.figSchemaDeflated = data.figSchemaDeflated
  graph.documentColorSpace = data.documentColorSpace
  graph.enabledLibraries = data.enabledLibraries ? new Map(data.enabledLibraries) : new Map()

  return graph
}
