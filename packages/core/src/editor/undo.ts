import { pick } from 'es-toolkit/object'

import { cloneVectorNetwork, type SceneNode } from '@open-pencil/scene-graph'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'
import type { UndoEntry } from '@open-pencil/scene-graph/undo'

import { restoreSubtree, snapshotSubtree } from './clipboard/subtree-history'
import { collectNodePositions, pushPositionUndo } from './history/position'
import {
  restorePageFromSnapshot as restorePageSnapshot,
  snapshotPage as createPageSnapshot,
  type PageSnapshot
} from './history/snapshot'
import type { EditorContext } from './types'

type ResizeSnapshot = Pick<SceneNode, 'x' | 'y' | 'width' | 'height' | 'vectorNetwork'>
type ResizeOriginal = Rect & { vectorNetwork?: SceneNode['vectorNetwork'] }

function createResizeSnapshot(node: SceneNode): ResizeSnapshot {
  return {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    vectorNetwork: node.vectorNetwork ? cloneVectorNetwork(node.vectorNetwork) : null
  }
}

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

  function commitResize(nodeId: string, original: ResizeOriginal) {
    const node = ctx.graph.getNode(nodeId)
    if (!node) return
    const final: ResizeOriginal =
      'vectorNetwork' in original
        ? createResizeSnapshot(node)
        : { x: node.x, y: node.y, width: node.width, height: node.height }
    ctx.undo.push({
      label: 'Resize',
      forward: () => {
        ctx.graph.updateNode(nodeId, final)
        ctx.runLayoutForNode(nodeId)
      },
      inverse: () => {
        ctx.graph.updateNode(nodeId, original)
        ctx.runLayoutForNode(nodeId)
      }
    })
  }

  function commitGroupResize(
    nodeId: string,
    origRect: Rect,
    origChildren: Map<string, ResizeSnapshot>
  ) {
    const node = ctx.graph.getNode(nodeId)
    if (!node) return
    const finalRect = { x: node.x, y: node.y, width: node.width, height: node.height }
    const finalChildren = new Map<string, ResizeSnapshot>()
    for (const [childId] of origChildren) {
      const child = ctx.graph.getNode(childId)
      if (child) finalChildren.set(childId, createResizeSnapshot(child))
    }
    ctx.undo.push({
      label: 'Resize',
      forward: () => {
        ctx.graph.updateNode(nodeId, finalRect)
        for (const [childId, final] of finalChildren) ctx.graph.updateNode(childId, final)
        ctx.runLayoutForNode(nodeId)
      },
      inverse: () => {
        ctx.graph.updateNode(nodeId, origRect)
        for (const [childId, orig] of origChildren) ctx.graph.updateNode(childId, orig)
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
    const current = pick(node, Object.keys(previous) as (keyof SceneNode)[]) as Partial<SceneNode>
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
    commitGroupResize,
    commitRotation,
    commitNodeUpdate,
    undoAction,
    redoAction,
    snapshotPage,
    restorePageFromSnapshot,
    pushUndoEntry
  }
}
