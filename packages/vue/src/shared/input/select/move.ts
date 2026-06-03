import type { Editor } from '@open-pencil/core/editor'

import type { DragOriginal as MoveOriginal } from '#vue/shared/input/drag-original'
import { duplicateAndDrag } from '#vue/shared/input/duplicate-drag'
import type { DragState } from '#vue/shared/input/types'

export function selectionIsLocked(editor: Editor) {
  return [...editor.state.selectedIds].every((id) => editor.graph.getNode(id)?.locked)
}

function autoLayoutMoveTarget(id: string, editor: Editor): string {
  let current = editor.graph.getNode(id)
  let target = current

  while (current?.parentId) {
    const parent = editor.graph.getNode(current.parentId)
    if (!parent) break
    if (
      current.type === 'INSTANCE' &&
      parent.layoutMode !== 'NONE' &&
      current.layoutPositioning !== 'ABSOLUTE'
    ) {
      target = current
    }
    current = parent
  }

  return target?.id ?? id
}

function collectMoveOriginals(editor: Editor) {
  const originals = new Map<string, MoveOriginal>()
  for (const selectedId of editor.state.selectedIds) {
    const id = autoLayoutMoveTarget(selectedId, editor)
    const node = editor.graph.getNode(id)
    if (node) {
      originals.set(id, {
        x: node.x,
        y: node.y,
        parentId: node.parentId ?? editor.state.currentPageId,
        layoutPositioning: node.layoutPositioning
      })
    }
  }
  return originals
}

function detectDragAutoLayoutParent(originals: Map<string, MoveOriginal>, editor: Editor) {
  if (originals.size !== 1) return undefined
  const [id, original] = [...originals][0]
  const node = editor.graph.getNode(id)
  const parent = editor.graph.getNode(original.parentId)
  if (parent && parent.layoutMode !== 'NONE' && node?.layoutPositioning !== 'ABSOLUTE') {
    return parent.id
  }
  return undefined
}

export function createSelectionMoveDrag(
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  editor: Editor,
  duplicate: boolean
): DragState {
  if (duplicate && editor.state.selectedIds.size > 0)
    return duplicateAndDrag(cx, cy, sx, sy, editor).drag

  const originals = collectMoveOriginals(editor)

  return {
    type: 'move',
    startX: cx,
    startY: cy,
    currentX: cx,
    currentY: cy,
    startScreenX: sx,
    startScreenY: sy,
    dragStarted: false,
    originals,
    autoLayoutParentId: detectDragAutoLayoutParent(originals, editor)
  }
}
