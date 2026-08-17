import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

export type NodeEditCapability =
  | { editable: true }
  | {
      editable: false
      reason: 'library-definition'
      libraryId: string
      assetKey: string
    }

export class ReadOnlyLibraryDefinitionError extends Error {
  readonly libraryId: string
  readonly assetKey: string

  constructor(libraryId: string, assetKey: string) {
    super(`This component belongs to library ${libraryId}. Edit the source library to change it.`)
    this.name = 'ReadOnlyLibraryDefinitionError'
    this.libraryId = libraryId
    this.assetKey = assetKey
  }
}

function libraryDefinitionOwner(graph: SceneGraph, nodeId: string): SceneNode | undefined {
  let node = graph.getNode(nodeId)
  while (node) {
    if (node.librarySource?.readOnly) return node
    node = node.parentId ? graph.getNode(node.parentId) : undefined
  }
  return undefined
}

export function getNodeEditCapability(graph: SceneGraph, nodeId: string): NodeEditCapability {
  const owner = libraryDefinitionOwner(graph, nodeId)
  const identity = owner?.librarySource?.identity
  return identity
    ? {
        editable: false,
        reason: 'library-definition',
        libraryId: identity.libraryId,
        assetKey: identity.assetKey
      }
    : { editable: true }
}

export function assertNodeEditable(graph: SceneGraph, nodeId: string): void {
  const capability = getNodeEditCapability(graph, nodeId)
  if (!capability.editable) {
    throw new ReadOnlyLibraryDefinitionError(capability.libraryId, capability.assetKey)
  }
}
