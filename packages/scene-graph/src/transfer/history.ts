import { cloneNodeProps } from '../copy'
import type { SceneGraph } from '../index'
import type { GraphTransferPlan } from './apply'

/** Capture post-placement state for redo; this does not authorize deleting shared resources. */
export function captureTransferredState(
  graph: SceneGraph,
  original: GraphTransferPlan
): GraphTransferPlan {
  const requireValue = <T>(value: T | undefined, kind: string, id: string): T => {
    if (value === undefined) throw new Error(`Missing transferred ${kind} ${id}`)
    return value
  }
  return {
    nodeIds: new Map(original.nodeIds),
    rootIds: [...original.rootIds],
    dependencyPageIds: [...original.dependencyPageIds],
    nodes: original.nodes.map((entry) => {
      const node = requireValue(graph.getNode(entry.id), 'node', entry.id)
      if (!node.parentId) throw new Error(`Missing transferred parent ${entry.id}`)
      return {
        id: node.id,
        type: node.type,
        parentId: node.parentId,
        props: cloneNodeProps(node, null)
      }
    }),
    variables: original.variables.map((variable) =>
      structuredClone(requireValue(graph.variables.get(variable.id), 'variable', variable.id))
    ),
    collections: original.collections.map((collection) =>
      structuredClone(
        requireValue(graph.variableCollections.get(collection.id), 'collection', collection.id)
      )
    ),
    activeModes: new Map(
      original.collections.map((collection) => [
        collection.id,
        requireValue(graph.activeMode.get(collection.id), 'active mode', collection.id)
      ])
    ),
    images: new Map(
      [...original.images.keys()].map((hash) => [
        hash,
        requireValue(graph.images.get(hash), 'image', hash).slice()
      ])
    )
  }
}

/** Record image ownership before commit, including when event delivery later throws. */
