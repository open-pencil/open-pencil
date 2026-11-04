import { isEqual, uniq } from 'es-toolkit'

import type { SceneGraph, SceneNode, Variable, VariableCollection } from '@open-pencil/scene-graph'

import { writeRecord } from '#core/editor/history/document-change'
import type { EditorContext } from '#core/editor/types'
import { computeAllLayouts } from '#core/layout'
import { reconcileVariableLayouts } from '#core/layout/variables'

/**
 * A page's layers, page first, and the document's variables, which the layers bind. Restoring
 * puts both back as they were: the layers of that page, and every variable and collection, as
 * undo of an edit that defined variables needs. Snapshots stay whole so coalesced undo entries,
 * which keep the first inverse and the last forward, still restore a consistent state.
 */
export interface PageSnapshot {
  nodes: Map<string, SceneNode>
  variables: Map<string, Variable>
  collections: Map<string, VariableCollection>
}

export function snapshotPage(graph: SceneGraph, pageId: string): PageSnapshot {
  const nodes = new Map<string, SceneNode>()
  const walk = (id: string) => {
    const node = graph.getNode(id)
    if (!node) return
    nodes.set(id, structuredClone(node))
    for (const childId of node.childIds) walk(childId)
  }
  walk(pageId)
  return {
    nodes,
    variables: structuredClone(graph.variables),
    collections: structuredClone(graph.variableCollections)
  }
}

/**
 * The variables restoring `snapshot` changes: those whose record differs from the saved one,
 * and those of a collection that does, whose modes they resolve in.
 */
function changedVariables(graph: SceneGraph, snapshot: PageSnapshot): string[] {
  const differs = <T>(current: Map<string, T>, saved: Map<string, T>) =>
    uniq([...current.keys(), ...saved.keys()]).filter(
      (id) => !isEqual(current.get(id), saved.get(id))
    )
  const collections = new Set(differs(graph.variableCollections, snapshot.collections))
  const inChangedCollection = [...graph.variables.values(), ...snapshot.variables.values()]
    .filter((variable) => collections.has(variable.collectionId))
    .map((variable) => variable.id)
  return [...differs(graph.variables, snapshot.variables), ...inChangedCollection]
}

/** Make `target` hold exactly the records of `saved`. */
function restoreRecords<T extends object>(target: Map<string, T>, saved: Map<string, T>): void {
  for (const id of target.keys()) if (!saved.has(id)) writeRecord(target, id, null)
  for (const [id, value] of saved) writeRecord(target, id, value)
}

/** Restore the page the snapshot was taken of, whichever page is on screen, and its variables. */
export function restorePageFromSnapshot(ctx: EditorContext, snapshot: PageSnapshot): void {
  // `snapshotPage` records the page first.
  const pageSnap = snapshot.nodes.values().next().value
  if (!pageSnap) return
  const page = ctx.graph.getNode(pageSnap.id)
  if (!page) return

  const variables = changedVariables(ctx.graph, snapshot)
  restoreRecords(ctx.graph.variableCollections, snapshot.collections)
  restoreRecords(ctx.graph.variables, snapshot.variables)
  for (const childId of page.childIds.slice()) ctx.graph.deleteNode(childId)
  restoreChildren(ctx.graph, snapshot.nodes, page.id, pageSnap.childIds)

  ctx.graph.clearAbsPosCache()
  computeAllLayouts(ctx.graph, page.id)
  // Layers on other pages that bind a restored variable take its restored value.
  if (variables.length > 0) reconcileVariableLayouts(ctx.graph, { variables })
  if (page.id === ctx.state.currentPageId) {
    ctx.setSelectedIds(new Set())
    ctx.state.hoveredNodeId = null
  }
  ctx.requestRender()
}

function restoreChildren(
  graph: SceneGraph,
  snapshot: PageSnapshot['nodes'],
  parentId: string,
  childIds: string[]
): void {
  for (const childId of childIds) {
    const snap = snapshot.get(childId)
    if (!snap) continue
    const { parentId: _snapParentId, childIds: snapChildIds, ...rest } = snap
    graph.createNode(snap.type, parentId, { ...rest, childIds: [] })
    graph.insertChildAt(snap.id, parentId, childIds.indexOf(childId))
    restoreChildren(graph, snapshot, snap.id, snapChildIds)
  }
}
