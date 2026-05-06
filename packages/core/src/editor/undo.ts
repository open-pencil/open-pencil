import type { SceneNode } from '#core/scene-graph'
import type { UndoEntry } from '#core/scene-graph/undo'
import type { Rect, Vector } from '#core/types'

import { restoreSubtree, snapshotSubtree } from './clipboard/subtree-history'
import { collectNodePositions, pushPositionUndo } from './history/position'
import {
  restorePageFromSnapshot as restorePageSnapshot,
  snapshotPage as createPageSnapshot,
  type PageSnapshot
} from './history/snapshot'
import type { EditorContext } from './types'

export function createUndoActions(ctx: EditorContext) {
  function commitMove(originals: Map<string, Vector>) {
    pushPositionUndo(ctx, 'Move', originals, collectNodePositions(ctx, originals.keys()))
  }

  function commitMoveWithReparent(
    originals: Map<string, { x: number; y: number; parentId: string }>
  ) {
    const finals = new Map<string, { x: number; y: number; parentId: string }>()
    for (const [id] of originals) {
      const n = ctx.graph.getNode(id)
      if (n) finals.set(id, { x: n.x, y: n.y, parentId: n.parentId ?? ctx.state.currentPageId })
    }
    ctx.undo.push({
      label: 'Move',
      forward: () => {
        for (const [id, pos] of finals) {
          ctx.graph.reparentNode(id, pos.parentId)
          ctx.graph.updateNode(id, { x: pos.x, y: pos.y })
          ctx.runLayoutForNode(id)
        }
      },
      inverse: () => {
        for (const [id, pos] of originals) {
          ctx.graph.reparentNode(id, pos.parentId)
          ctx.graph.updateNode(id, { x: pos.x, y: pos.y })
          ctx.runLayoutForNode(id)
        }
      }
    })
  }

  function commitDuplicateMove(rootIds: string[], previousSelection: Set<string>) {
    const snapshots = new Map<string, SceneNode>()
    for (const id of rootIds) {
      const subtree = snapshotSubtree(ctx.graph, id)
      for (const [nodeId, snapshot] of subtree) snapshots.set(nodeId, snapshot)
    }
    const nextSelection = new Set(rootIds)

    ctx.undo.push({
      label: 'Duplicate',
      forward: () => {
        for (const id of rootIds) {
          if (ctx.graph.getNode(id)) continue
          const snapshot = snapshots.get(id)
          if (!snapshot) continue
          restoreSubtree(
            ctx.graph,
            snapshot,
            snapshot.parentId ?? ctx.state.currentPageId,
            snapshots
          )
          ctx.runLayoutForNode(id)
        }
        ctx.setSelectedIds(new Set(nextSelection))
      },
      inverse: () => {
        for (const id of rootIds.toReversed()) ctx.graph.deleteNode(id)
        ctx.setSelectedIds(new Set(previousSelection))
      }
    })
  }

  function commitResize(nodeId: string, origRect: Rect) {
    const node = ctx.graph.getNode(nodeId)
    if (!node) return
    const finalRect = { x: node.x, y: node.y, width: node.width, height: node.height }
    ctx.undo.push({
      label: 'Resize',
      forward: () => {
        ctx.graph.updateNode(nodeId, finalRect)
        ctx.runLayoutForNode(nodeId)
      },
      inverse: () => {
        ctx.graph.updateNode(nodeId, origRect)
        ctx.runLayoutForNode(nodeId)
      }
    })
  }

  function commitRotation(nodeId: string, origRotation: number) {
    const node = ctx.graph.getNode(nodeId)
    if (!node) return
    const finalRotation = node.rotation
    ctx.undo.push({
      label: 'Rotate',
      forward: () => {
        ctx.graph.updateNode(nodeId, { rotation: finalRotation })
      },
      inverse: () => {
        ctx.graph.updateNode(nodeId, { rotation: origRotation })
      }
    })
  }

  function commitNodeUpdate(nodeId: string, previous: Partial<SceneNode>, label = 'Update') {
    const node = ctx.graph.getNode(nodeId)
    if (!node) return
    const current = Object.fromEntries(
      (Object.keys(previous) as (keyof SceneNode)[]).map((key) => [key, node[key]])
    ) as Partial<SceneNode>
    ctx.undo.push({
      label,
      forward: () => {
        ctx.graph.updateNode(nodeId, current)
        ctx.runLayoutForNode(nodeId)
      },
      inverse: () => {
        ctx.graph.updateNode(nodeId, previous)
        ctx.runLayoutForNode(nodeId)
      }
    })
  }

  function undoAction(validateEnteredContainer: () => void) {
    ctx.undo.undo()
    validateEnteredContainer()
    ctx.requestRender()
  }

  function redoAction(validateEnteredContainer: () => void) {
    ctx.undo.redo()
    validateEnteredContainer()
    ctx.requestRender()
  }

  function snapshotPage(): PageSnapshot {
    return createPageSnapshot(ctx.graph, ctx.state.currentPageId)
  }

  function restorePageFromSnapshot(snapshot: PageSnapshot) {
    restorePageSnapshot(ctx, snapshot)
  }

  function pushUndoEntry(entry: UndoEntry) {
    ctx.undo.push(entry)
  }

  return {
    commitMove,
    commitMoveWithReparent,
    commitDuplicateMove,
    commitResize,
    commitRotation,
    commitNodeUpdate,
    undoAction,
    redoAction,
    snapshotPage,
    restorePageFromSnapshot,
    pushUndoEntry
  }
}
