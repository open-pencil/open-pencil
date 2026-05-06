import type { EditorContext } from '#core/editor/types'
import { computeAllLayouts } from '#core/layout'
import type { SceneGraph, SceneNode } from '#core/scene-graph'

export type PageSnapshot = Map<string, SceneNode>

export function snapshotPage(graph: SceneGraph, pageId: string): PageSnapshot {
  const snapshot: PageSnapshot = new Map()
  const walk = (id: string) => {
    const node = graph.getNode(id)
    if (!node) return
    snapshot.set(id, structuredClone(node))
    for (const childId of node.childIds) walk(childId)
  }
  walk(pageId)
  return snapshot
}

export function restorePageFromSnapshot(ctx: EditorContext, snapshot: PageSnapshot): void {
  const pageId = ctx.state.currentPageId
  const page = ctx.graph.getNode(pageId)
  const pageSnap = snapshot.get(pageId)
  if (!page || !pageSnap) return

  for (const childId of page.childIds.slice()) ctx.graph.deleteNode(childId)
  restoreChildren(ctx.graph, snapshot, pageId, pageSnap.childIds)

  ctx.graph.clearAbsPosCache()
  computeAllLayouts(ctx.graph, pageId)
  ctx.setSelectedIds(new Set())
  ctx.state.hoveredNodeId = null
  ctx.requestRender()
}

function restoreChildren(
  graph: SceneGraph,
  snapshot: PageSnapshot,
  parentId: string,
  childIds: string[]
): void {
  for (const childId of childIds) {
    const snap = snapshot.get(childId)
    if (!snap) continue
    const { parentId: _snapParentId, childIds: snapChildIds, ...rest } = snap
    graph.createNode(snap.type, parentId, { ...rest, childIds: [] })
    graph.reorderChild(snap.id, parentId, childIds.indexOf(childId))
    restoreChildren(graph, snapshot, snap.id, snapChildIds)
  }
}
