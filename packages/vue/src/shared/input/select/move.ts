import type { Editor } from '@open-pencil/core/editor'

import { duplicateAndDrag } from '#vue/shared/input/duplicate-drag'
import { detectAutoLayoutParent } from '#vue/shared/input/move'
import type { DragState } from '#vue/shared/input/types'

type MoveOriginal = { x: number; y: number; parentId: string }

export function selectionIsLocked(editor: Editor) {
  return [...editor.state.selectedIds].every((id) => editor.graph.getNode(id)?.locked)
}

function collectMoveOriginals(editor: Editor) {
  const originals = new Map<string, MoveOriginal>()
  for (const id of editor.state.selectedIds) {
    const node = editor.graph.getNode(id)
    if (node) {
      originals.set(id, {
        x: node.x,
        y: node.y,
        parentId: node.parentId ?? editor.state.currentPageId
      })
    }
  }
  return originals
}

export function createSelectionMoveDrag(
  cx: number,
  cy: number,
  editor: Editor,
  duplicate: boolean
): DragState {
  if (duplicate && editor.state.selectedIds.size > 0) return duplicateAndDrag(cx, cy, editor).drag

  return {
    type: 'move',
    startX: cx,
    startY: cy,
    currentX: cx,
    currentY: cy,
    originals: collectMoveOriginals(editor),
    autoLayoutParentId: detectAutoLayoutParent(editor)
  }
}
