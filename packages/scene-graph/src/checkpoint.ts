import { isEqual } from 'es-toolkit'

import type { SceneGraph } from './graph'

/** Capture rollback state without changing graph or surviving object identities. */
export function captureGraphCheckpoint(graph: SceneGraph) {
  const nodeRefs = new Map(graph.nodes)
  const variableRefs = new Map(graph.variables)
  const collectionRefs = new Map(graph.variableCollections)
  const snapshot = structuredClone({
    nodes: graph.nodes,
    variables: graph.variables,
    variableCollections: graph.variableCollections,
    activeMode: graph.activeMode,
    instanceIndex: graph.instanceIndex,
    enabledLibraries: graph.enabledLibraries,
    rootId: graph.rootId,
    figKiwiVersion: graph.figKiwiVersion,
    figSchemaDeflated: graph.figSchemaDeflated,
    documentColorSpace: graph.documentColorSpace
  })
  // Atomic property tools cannot edit assets. Retain existing buffers, not copies of every bitmap.
  const images = new Map(graph.images)

  function assertPropertiesOnly() {
    if (
      snapshot.nodes.size !== graph.nodes.size ||
      snapshot.variables.size !== graph.variables.size
    )
      throw new Error('Atomic tools must not create or remove nodes or variables')
    for (const [id, before] of snapshot.nodes) {
      const after = graph.nodes.get(id)
      if (
        !after ||
        after !== nodeRefs.get(id) ||
        before.id !== after.id ||
        before.type !== after.type ||
        before.parentId !== after.parentId ||
        before.componentId !== after.componentId ||
        !isEqual(before.childIds, after.childIds)
      ) {
        throw new Error('Atomic tools must not change node hierarchy or identity')
      }
    }
    for (const [id, before] of snapshot.variables) {
      const after = graph.variables.get(id)
      if (
        !after ||
        after !== variableRefs.get(id) ||
        before.id !== after.id ||
        before.collectionId !== after.collectionId ||
        before.type !== after.type
      )
        throw new Error('Atomic tools must not change variable identity')
    }
    assertDocumentUnchanged()
  }

  function assertDocumentUnchanged() {
    if (
      !isEqual(snapshot.variableCollections, graph.variableCollections) ||
      !isEqual(snapshot.activeMode, graph.activeMode) ||
      !isEqual(snapshot.instanceIndex, graph.instanceIndex) ||
      !isEqual(snapshot.enabledLibraries, graph.enabledLibraries) ||
      images.size !== graph.images.size ||
      [...images].some(([id, bytes]) => graph.images.get(id) !== bytes) ||
      graph.rootId !== snapshot.rootId ||
      graph.documentColorSpace !== snapshot.documentColorSpace ||
      graph.figKiwiVersion !== snapshot.figKiwiVersion ||
      !isEqual(graph.figSchemaDeflated, snapshot.figSchemaDeflated)
    ) {
      throw new Error('Atomic tools must not change collections, assets or document metadata')
    }
  }

  function restore() {
    const failedNodes = new Map(graph.nodes)
    restoreObjects(graph.nodes, snapshot.nodes, nodeRefs)
    restoreObjects(graph.variables, snapshot.variables, variableRefs)
    restoreObjects(graph.variableCollections, snapshot.variableCollections, collectionRefs)
    restoreMap(graph.activeMode, structuredClone(snapshot.activeMode))
    restoreMap(graph.instanceIndex, structuredClone(snapshot.instanceIndex))
    restoreMap(graph.enabledLibraries, structuredClone(snapshot.enabledLibraries))
    restoreMap(graph.images, images)
    graph.rootId = snapshot.rootId
    graph.figKiwiVersion = snapshot.figKiwiVersion
    graph.figSchemaDeflated = structuredClone(snapshot.figSchemaDeflated)
    graph.documentColorSpace = snapshot.documentColorSpace
    graph.clearAbsPosCache()
    // Notify consumers only after the complete hierarchy and indexes have been restored.
    for (const [id, node] of failedNodes) {
      if (!graph.nodes.has(id)) graph.emitter.emit('node:deleted', id, node.parentId)
    }
    for (const [id, node] of graph.nodes) {
      if (failedNodes.has(id)) graph.emitter.emit('node:updated', id, node)
      else graph.emitter.emit('node:created', node)
    }
  }

  return { nodes: snapshot.nodes, variables: snapshot.variables, assertPropertiesOnly, restore }
}

function restoreObjects<T extends object>(
  target: Map<string, T>,
  snapshot: Map<string, T>,
  refs: Map<string, T>
) {
  target.clear()
  for (const [id, saved] of snapshot) {
    const original = refs.get(id)
    if (!original) throw new Error(`Missing checkpoint reference: ${id}`)
    for (const key of Object.keys(original) as (keyof T)[]) {
      if (!(key in saved)) Reflect.deleteProperty(original, key)
    }
    Object.assign(original, structuredClone(saved))
    target.set(id, original)
  }
}

function restoreMap<K, V>(target: Map<K, V>, saved: Map<K, V>) {
  target.clear()
  for (const [key, value] of saved) target.set(key, value)
}
