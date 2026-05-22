import type { EditorContext } from '#core/editor/types'
import { computeAbsoluteBounds } from '#core/geometry'
import { computeAllLayouts } from '#core/layout'
import type { SceneNode } from '#core/scene-graph'

import { deleteIds, type DeletedEntry, recreateSnapshots, restoreDeletedEntries } from './history'
import { collectSubtrees, snapshotSubtree } from './subtree-history'

type CenterNodesAt = (nodeIds: string[], cx: number, cy: number) => void

export function selectedReplacementTargets(ctx: EditorContext) {
  const selected = [...ctx.state.selectedIds]
    .map((id) => ctx.graph.getNode(id))
    .filter((node): node is SceneNode => node != null && !node.locked)
  const selectedSet = new Set(selected.map((node) => node.id))
  return selected.filter((node) => !node.parentId || !selectedSet.has(node.parentId))
}

function reorderCreatedAtReplacementIndex(
  ctx: EditorContext,
  created: string[],
  deleted: DeletedEntry[]
) {
  const insertParentId = deleted[0]?.parentId
  if (!insertParentId) return
  const insertIndex = deleted[0]?.index ?? 0
  for (let i = 0; i < created.length; i++) {
    ctx.graph.reorderChild(created[i], insertParentId, insertIndex + i)
  }
}

function pushPasteReplaceUndo(
  ctx: EditorContext,
  created: string[],
  deleted: DeletedEntry[],
  prevSelection: Set<string>
) {
  const createdSnapshots = collectSubtrees(ctx.graph, created)
  const pageId = ctx.state.currentPageId
  ctx.undo.push({
    label: 'Paste to replace',
    forward: () => {
      for (const { id } of deleted) ctx.graph.deleteNode(id)
      recreateSnapshots(ctx, createdSnapshots, pageId)
      reorderCreatedAtReplacementIndex(ctx, created, deleted)
      computeAllLayouts(ctx.graph, pageId)
      ctx.setSelectedIds(new Set(created))
    },
    inverse: () => {
      deleteIds(ctx, created)
      restoreDeletedEntries(ctx, deleted)
      computeAllLayouts(ctx.graph, pageId)
      ctx.setSelectedIds(prevSelection)
    }
  })
}

export function replaceTargetsWithCreated(
  ctx: EditorContext,
  centerNodesAt: CenterNodesAt,
  created: string[],
  targets: SceneNode[],
  prevSelection: Set<string>
) {
  if (created.length === 0 || targets.length === 0) return false
  const deleted = targets.map((node) => {
    const parentId = node.parentId ?? ctx.state.currentPageId
    const parent = ctx.graph.getNode(parentId)
    return {
      id: node.id,
      parentId,
      index: parent?.childIds.indexOf(node.id) ?? -1,
      subtree: snapshotSubtree(ctx.graph, node.id)
    }
  })

  const targetBounds = computeAbsoluteBounds(targets, (id) => ctx.graph.getAbsolutePosition(id))
  centerNodesAt(
    created,
    targetBounds.x + targetBounds.width / 2,
    targetBounds.y + targetBounds.height / 2
  )
  reorderCreatedAtReplacementIndex(ctx, created, deleted)
  for (const { id } of deleted) ctx.graph.deleteNode(id)
  computeAllLayouts(ctx.graph, ctx.state.currentPageId)
  ctx.setSelectedIds(new Set(created))
  pushPasteReplaceUndo(ctx, created, deleted, prevSelection)
  return true
}
