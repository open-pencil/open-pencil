import { computeAllLayouts } from '../layout'

import type { Rect, Vector } from '../types'
import type { SceneNode } from '../scene-graph'
import type { UndoEntry } from '../undo'
import type { EditorContext } from './types'

export function createUndoActions(ctx: EditorContext) {
  function commitMove(originals: Map<string, Vector>) {
    const finals = new Map<string, Vector>()
    for (const [id] of originals) {
      const n = ctx.graph.getNode(id)
      if (n) finals.set(id, { x: n.x, y: n.y })
    }
    ctx.undo.push({
      label: 'Move',
      forward: () => {
        for (const [id, pos] of finals) {
          ctx.graph.updateNode(id, pos)
          ctx.runLayoutForNode(id)
        }
      },
      inverse: () => {
        for (const [id, pos] of originals) {
          ctx.graph.updateNode(id, pos)
          ctx.runLayoutForNode(id)
        }
      }
    })
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
  }

  function redoAction(validateEnteredContainer: () => void) {
    ctx.undo.redo()
    validateEnteredContainer()
    ctx.requestRender()
  }

  function snapshotPage(): Map<string, SceneNode> {
    const snapshot = new Map<string, SceneNode>()
    const walk = (id: string) => {
      const node = ctx.graph.getNode(id)
      if (!node) return
      snapshot.set(id, structuredClone(node))
      for (const childId of node.childIds) walk(childId)
    }
    walk(ctx.state.currentPageId)
    return snapshot
  }

  function restorePageFromSnapshot(snapshot: Map<string, SceneNode>) {
    const page = ctx.graph.getNode(ctx.state.currentPageId)
    if (!page) return

    for (const childId of page.childIds.slice()) {
      ctx.graph.deleteNode(childId)
    }

    const pageSnap = snapshot.get(ctx.state.currentPageId)
    if (pageSnap) page.childIds = [...pageSnap.childIds]

    for (const [id, snap] of snapshot) {
      if (id === ctx.state.currentPageId) continue
      ctx.graph.nodes.set(id, structuredClone(snap))
    }

    ctx.graph.clearAbsPosCache()
    computeAllLayouts(ctx.graph, ctx.state.currentPageId)
    ctx.state.selectedIds = new Set()
    ctx.state.hoveredNodeId = null
    ctx.graph.emitter.emit('node:reordered', ctx.state.currentPageId, ctx.graph.rootId, 0)
    ctx.requestRender()
  }

  function pushUndoEntry(entry: UndoEntry) {
    ctx.undo.push(entry)
  }

  return {
    commitMove,
    commitMoveWithReparent,
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
