import { isEqual } from 'es-toolkit'

import type { SceneGraph } from './graph'
import { createSceneMutationImpact, recordSceneMutations } from './mutation-impact'
import type { SceneNode, Variable, VariableCollection } from './types'

const NODE_COUNT_ERROR = 'Atomic tools must not create or remove nodes or variables'
const NODE_IDENTITY_ERROR = 'Atomic tools must not change node hierarchy or identity'
const VARIABLE_IDENTITY_ERROR = 'Atomic tools must not change variable identity'
const DOCUMENT_ERROR = 'Atomic tools must not change collections, assets or document metadata'

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
      throw new Error(NODE_COUNT_ERROR)
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
        throw new Error(NODE_IDENTITY_ERROR)
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
        throw new Error(VARIABLE_IDENTITY_ERROR)
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
      throw new Error(DOCUMENT_ERROR)
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

/**
 * Rollback state for an edit that may only change properties, which costs what the edit touches
 * rather than a copy of the document: a node is copied the first time the graph reports it about
 * to change (`SceneGraph.observeNodeChanges`), together with its ancestors below the page, which
 * keep instance override maps the graph writes into in place.
 */
export interface TouchedCheckpoint {
  /** Copies of the reported nodes and their ancestors below the page, as they were before. */
  readonly nodes: ReadonlyMap<string, SceneNode>
  /** Nodes the graph reported changing or creating. */
  readonly reported: ReadonlySet<string>
  /** Copies of every variable, as variables have no change report. */
  readonly variables: ReadonlyMap<string, Variable>
  readonly variableCollections: ReadonlyMap<string, VariableCollection>
  /** Throws unless the edit only changed properties of existing nodes and variables. */
  assertPropertiesOnly(): void
  /** Stops observing and puts back everything the edit changed, keeping object identities. */
  restore(): void
  /** Stops observing the graph. */
  stop(): void
}

/**
 * Starts observing `graph` for an edit that may only change properties. Node identities are
 * kept as pointers, so replacing, adding, or removing a node anywhere is found; a node's fields
 * are compared and restored only where the graph reported it, so code that writes into a node
 * directly calls `SceneGraph.willChangeNode` first, and a node event without such a report fails
 * the edit.
 */
export function captureTouchedCheckpoint(graph: SceneGraph): TouchedCheckpoint {
  const nodeRefs = new Map(graph.nodes)
  const variableRefs = new Map(graph.variables)
  const collectionRefs = new Map(graph.variableCollections)
  const saved = structuredClone({
    variables: graph.variables,
    variableCollections: graph.variableCollections,
    activeMode: graph.activeMode,
    instanceIndex: graph.instanceIndex,
    enabledLibraries: graph.enabledLibraries
  })
  // Property edits cannot edit assets. Retain existing buffers, not copies of every bitmap.
  const images = new Map(graph.images)
  const { rootId, figKiwiVersion, figSchemaDeflated, documentColorSpace } = graph
  const nodes = new Map<string, SceneNode>()
  const reported = new Set<string>()
  const created = new Set<string>()
  const impact = createSceneMutationImpact()

  /** Copies a node as the edit found it: the original object, should the edit have replaced it. */
  function copy(node: SceneNode) {
    nodes.set(node.id, structuredClone(nodeRefs.get(node.id) ?? node))
  }

  const skipped = (node: SceneNode) => nodes.has(node.id) || created.has(node.id)

  /**
   * Copies `node` and each ancestor not copied yet, up to but excluding its page. An ancestor
   * copied already had its own ancestors copied with it, so the walk stops there.
   */
  function copyLineage(node: SceneNode) {
    if (skipped(node)) return
    copy(node)
    if (!node.parentId) return
    graph.closest(node.parentId, (ancestor) => {
      if (ancestor.type === 'CANVAS' || ancestor.id === rootId || skipped(ancestor)) return true
      copy(ancestor)
      return false
    })
  }

  const unobserve = graph.observeNodeChanges({
    created: (node) => {
      created.add(node.id)
      reported.add(node.id)
    },
    before: (node) => {
      reported.add(node.id)
      copyLineage(node)
    }
  })
  const unbindEvents = recordSceneMutations(graph, impact)
  let observing = true

  function stop() {
    if (!observing) return
    observing = false
    unobserve()
    unbindEvents()
  }

  function assertNodes() {
    if (
      created.size > 0 ||
      impact.deletedNodeIds.size > 0 ||
      graph.nodes.size !== nodeRefs.size ||
      graph.variables.size !== variableRefs.size
    )
      throw new Error(NODE_COUNT_ERROR)
    for (const [id, node] of graph.nodes) {
      const original = nodeRefs.get(id)
      if (!original) throw new Error(NODE_COUNT_ERROR)
      if (original !== node) throw new Error(NODE_IDENTITY_ERROR)
    }
    for (const [id, before] of nodes) {
      const after = graph.nodes.get(id)
      if (
        !after ||
        before.id !== after.id ||
        before.type !== after.type ||
        before.parentId !== after.parentId ||
        before.componentId !== after.componentId ||
        !isEqual(before.childIds, after.childIds)
      )
        throw new Error(NODE_IDENTITY_ERROR)
    }
    for (const id of [
      ...impact.changedNodeIds,
      ...impact.previousParentIds,
      ...impact.currentParentIds
    ]) {
      if (!nodes.has(id) && !created.has(id)) {
        throw new Error(
          `Atomic tools must report layer changes to the scene graph (SceneGraph.willChangeNode): ${id}`
        )
      }
    }
  }

  function assertPropertiesOnly() {
    assertNodes()
    for (const [id, before] of saved.variables) {
      const after = graph.variables.get(id)
      if (
        !after ||
        after !== variableRefs.get(id) ||
        before.id !== after.id ||
        before.collectionId !== after.collectionId ||
        before.type !== after.type
      )
        throw new Error(VARIABLE_IDENTITY_ERROR)
    }
    if (
      !isEqual(saved.variableCollections, graph.variableCollections) ||
      !isEqual(saved.activeMode, graph.activeMode) ||
      !isEqual(saved.instanceIndex, graph.instanceIndex) ||
      !isEqual(saved.enabledLibraries, graph.enabledLibraries) ||
      images.size !== graph.images.size ||
      [...images].some(([id, bytes]) => graph.images.get(id) !== bytes) ||
      graph.rootId !== rootId ||
      graph.documentColorSpace !== documentColorSpace ||
      graph.figKiwiVersion !== figKiwiVersion ||
      // Every writer assigns a new schema rather than writing into it.
      graph.figSchemaDeflated !== figSchemaDeflated
    )
      throw new Error(DOCUMENT_ERROR)
  }

  /** Puts the node map back as it was, in its order, if the edit changed its entries. */
  function restoreNodeMap(): { removed: Map<string, SceneNode>; readded: Set<string> } {
    const removed = new Map<string, SceneNode>()
    const readded = new Set<string>()
    let changed = graph.nodes.size !== nodeRefs.size
    if (!changed) {
      // In lockstep, so a node removed and set again, which moves to the end, is put back too.
      const live = graph.nodes.entries()
      for (const [id, node] of nodeRefs) {
        const next = live.next()
        if (next.done || next.value[0] !== id || next.value[1] !== node) {
          changed = true
          break
        }
      }
    }
    if (!changed) return { removed, readded }
    const failed = new Map(graph.nodes)
    graph.nodes.clear()
    for (const [id, node] of nodeRefs) {
      graph.nodes.set(id, node)
      if (!failed.has(id)) readded.add(id)
    }
    for (const [id, node] of failed) if (!nodeRefs.has(id)) removed.set(id, node)
    return { removed, readded }
  }

  function restore() {
    stop()
    const { removed, readded } = restoreNodeMap()
    for (const [id, copy] of nodes) {
      const original = nodeRefs.get(id)
      if (!original) continue
      for (const key of Object.keys(original)) {
        if (!Object.hasOwn(copy, key)) Reflect.deleteProperty(original, key)
      }
      Object.assign(original, structuredClone(copy))
    }
    restoreObjects(graph.variables, saved.variables, variableRefs)
    restoreObjects(graph.variableCollections, saved.variableCollections, collectionRefs)
    restoreMap(graph.activeMode, structuredClone(saved.activeMode))
    restoreMap(graph.instanceIndex, structuredClone(saved.instanceIndex))
    restoreMap(graph.enabledLibraries, structuredClone(saved.enabledLibraries))
    restoreMap(graph.images, images)
    graph.rootId = rootId
    graph.figKiwiVersion = figKiwiVersion
    graph.figSchemaDeflated = figSchemaDeflated
    graph.documentColorSpace = documentColorSpace
    graph.clearAbsPosCache()
    const touched = new Set([
      ...nodes.keys(),
      ...created,
      ...readded,
      ...removed.keys(),
      ...impact.changedNodeIds,
      ...impact.previousParentIds,
      ...impact.currentParentIds
    ])
    for (const id of touched) {
      if (graph.nodes.get(id)?.type === 'CONNECTOR') graph.connectorIds.add(id)
      else graph.connectorIds.delete(id)
    }
    // Notify consumers only after the complete hierarchy and indexes have been restored.
    for (const [id, node] of removed) graph.emitter.emit('node:deleted', id, node.parentId)
    for (const id of touched) {
      const node = graph.nodes.get(id)
      if (!node) continue
      if (readded.has(id)) graph.emitter.emit('node:created', node)
      else graph.emitter.emit('node:updated', id, node)
    }
  }

  return {
    nodes,
    reported,
    variables: saved.variables,
    variableCollections: saved.variableCollections,
    assertPropertiesOnly,
    restore,
    stop
  }
}
