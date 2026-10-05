import { isEqual } from 'es-toolkit/predicate'

import type { SceneGraph } from '@open-pencil/scene-graph'

/** The layer tree as the shared document records it. */
export interface SyncedTree {
  /** A layer's synced parent: null for the document root, undefined when it is not synced. */
  parentOf(nodeId: string): string | null | undefined
  /** The child order a layer's synced `childIds` lists. */
  childOrderOf(nodeId: string): readonly string[]
}

/**
 * Moves the changed layers under their synced parents and orders every parent they touch.
 *
 * Peers can move two layers into each other at the same time, so a move that would make a layer
 * its own ancestor is skipped; the skipped ids are returned for the caller to write back. A
 * parent lists its children in its synced order, then the children that order misses by id, so
 * every peer derives the same order from the same document and each child's `parentId` matches
 * its parent's `childIds`.
 */
export function applySyncedTree(
  graph: SceneGraph,
  tree: SyncedTree,
  nodeIds: Iterable<string>
): string[] {
  const touched = new Set<string>()
  const pending = new Map<string, string>()
  for (const id of nodeIds) {
    const node = graph.getNode(id)
    if (!node) continue
    touched.add(id)
    const parentId = tree.parentOf(id)
    if (typeof parentId === 'string' && parentId !== node.parentId) pending.set(id, parentId)
  }

  // A move can depend on another in the same change (A leaves B, then B enters A).
  let moved = true
  while (moved) {
    moved = false
    for (const [id, parentId] of pending) {
      if (parentId === id || graph.isDescendant(parentId, id)) continue
      const previousParentId = graph.getNode(id)?.parentId
      if (previousParentId) touched.add(previousParentId)
      touched.add(parentId)
      moveUnder(graph, id, parentId)
      pending.delete(id)
      moved = true
    }
  }

  for (const id of touched) orderChildren(graph, tree, id)
  return [...pending.keys()]
}

function moveUnder(graph: SceneGraph, id: string, parentId: string) {
  const parent = graph.getNode(parentId)
  if (parent) graph.insertChildAt(id, parentId, parent.childIds.length)
  // A parent that has not arrived yet adopts the layer from its synced childIds; the old
  // parent drops it when its children are ordered.
  else graph.updateNode(id, { parentId })
}

function orderChildren(graph: SceneGraph, tree: SyncedTree, parentId: string) {
  const parent = graph.getNode(parentId)
  if (!parent) return
  const isChild = (id: string) => graph.getNode(id)?.parentId === parentId
  const listed = new Set(tree.childOrderOf(parentId).filter(isChild))
  const unlisted = [...new Set(parent.childIds)].filter((id) => !listed.has(id) && isChild(id))
  const childIds = [...listed, ...unlisted.sort()]
  if (!isEqual(childIds, parent.childIds)) graph.updateNode(parentId, { childIds })
}
