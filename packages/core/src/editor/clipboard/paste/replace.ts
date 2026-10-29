import { isNotNil } from 'es-toolkit/predicate'

import type { SceneNode } from '@open-pencil/scene-graph'
import { getAxisAlignedBoundsInParent } from '@open-pencil/scene-graph/coordinate'

import { getNodeEditCapability } from '#core/editor/capabilities'
import {
  deleteIds,
  type DeletedEntry,
  recreateSnapshots,
  restoreDeletedEntries
} from '#core/editor/clipboard/history'
import { translateOnCanvas } from '#core/editor/clipboard/placement'
import { collectSubtrees, snapshotSubtree } from '#core/editor/history/subtree'
import type { EditorContext } from '#core/editor/types'
import { computeAllLayouts } from '#core/layout'

export interface PasteHistoryOperation {
  capture: () => void
  undo: () => void
  redo: () => void
}

export function selectedReplacementTargets(ctx: EditorContext) {
  const selected = [...ctx.state.selectedIds]
    .map((id) => ctx.graph.getNode(id))
    .filter(
      (node): node is SceneNode =>
        node != null && !node.locked && getNodeEditCapability(ctx.graph, node.id).editable
    )
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
    // A paste that could not go into the target's parent, such as an instance of a component
    // the parent is inside, stays in the ancestor it went to.
    if (ctx.graph.getNode(created[i])?.parentId !== insertParentId) continue
    ctx.graph.insertChildAt(created[i], insertParentId, insertIndex + i)
  }
}

function pushPasteReplaceUndo(
  ctx: EditorContext,
  created: string[],
  deleted: DeletedEntry[],
  prevSelection: Set<string>,
  operation?: PasteHistoryOperation
) {
  const createdSnapshots = collectSubtrees(ctx.graph, created)
  const pageId = ctx.state.currentPageId
  operation?.capture()
  ctx.undo.push({
    label: 'Paste to replace',
    forward: () => {
      ctx.graph.withBufferedEvents(() => {
        // Restore first: validation or insertion failure must not delete the original targets.
        if (operation) operation.redo()
        else recreateSnapshots(ctx, createdSnapshots, pageId)
        for (const { id } of deleted) ctx.graph.deleteNode(id)
        reorderCreatedAtReplacementIndex(ctx, created, deleted)
      })
      computeAllLayouts(ctx.graph, pageId)
      ctx.setSelectedIds(new Set(created))
    },
    inverse: () => {
      if (operation) operation.undo()
      else deleteIds(ctx, created)
      restoreDeletedEntries(ctx, deleted)
      computeAllLayouts(ctx.graph, pageId)
      ctx.setSelectedIds(prevSelection)
    }
  })
}

/**
 * Moves the replacement so its canvas box starts where the targets' did, as Figma does, so an
 * offset, rotated, or flipped frame keeps it in their place.
 */
function alignWithTargets(ctx: EditorContext, created: string[], targets: SceneNode[]) {
  const nodes = created.map((id) => ctx.graph.getNode(id)).filter(isNotNil)
  const from = getAxisAlignedBoundsInParent(nodes, ctx.graph.rootId, ctx.graph)
  const to = getAxisAlignedBoundsInParent(targets, ctx.graph.rootId, ctx.graph)
  translateOnCanvas(ctx.graph, created, to.x - from.x, to.y - from.y)
}

export function replaceTargetsWithCreated(
  ctx: EditorContext,
  created: string[],
  targets: SceneNode[],
  prevSelection: Set<string>,
  operation?: PasteHistoryOperation
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

  alignWithTargets(ctx, created, targets)
  reorderCreatedAtReplacementIndex(ctx, created, deleted)
  for (const { id } of deleted) ctx.graph.deleteNode(id)
  computeAllLayouts(ctx.graph, ctx.state.currentPageId)
  ctx.setSelectedIds(new Set(created))
  pushPasteReplaceUndo(ctx, created, deleted, prevSelection, operation)
  return true
}
