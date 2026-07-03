import type { SceneNode } from '@open-pencil/scene-graph'

import type { EditorContext } from '#core/editor/types'

import { restoreSubtree } from './subtree-history'

export type DeletedEntry = {
  id: string
  parentId: string
  index: number
  subtree: Map<string, SceneNode>
}

export function recreateSnapshots(ctx: EditorContext, snapshots: SceneNode[], pageId: string) {
  for (const snapshot of snapshots) {
    ctx.graph.createNode(snapshot.type, snapshot.parentId ?? pageId, {
      ...snapshot,
      childIds: []
    })
  }
}

export function deleteIds(ctx: EditorContext, ids: string[]) {
  for (const id of [...ids].reverse()) ctx.graph.deleteNode(id)
}

export function restoreDeletedEntries(ctx: EditorContext, entries: DeletedEntry[]) {
  for (const { id, parentId, index, subtree } of [...entries].reverse()) {
    const rootSnap = subtree.get(id)
    if (rootSnap) restoreSubtree(ctx.graph, rootSnap, parentId, subtree)
    if (index >= 0) ctx.graph.reorderChild(id, parentId, index)
  }
}
