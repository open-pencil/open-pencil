import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'

import type { DragOriginal as MoveOriginal } from '#vue/shared/input/drag-original'
import { duplicateAndDrag } from '#vue/shared/input/duplicate-drag'
import type { DragState } from '#vue/shared/input/types'

function isLockedInTree(id: string, editor: Editor) {
  for (
    let node = editor.graph.getNode(id);
    node;
    node = editor.graph.getNode(node.parentId ?? '')
  ) {
    if (node.locked) return true
  }
  return false
}

/** Whether nothing selected can move: locked layers, and layers inside locked ones, stay put. */
export function selectionIsLocked(editor: Editor) {
  return [...editor.state.selectedIds].every((id) => isLockedInTree(id, editor))
}

/**
 * Whether pressing `hit` should drag the current selection, as in Figma: the hit lies inside a
 * selected layer, or a selected layer under the point lies inside the hit group or boolean.
 */
export function pressesSelection(hit: SceneNode, cx: number, cy: number, editor: Editor) {
  return [...editor.state.selectedIds].some((id) => {
    if (id === hit.id) return false
    if (editor.graph.isDescendant(hit.id, id)) return true
    return editor.graph.isDescendant(id, hit.id) && editor.graph.isPointInNode(id, cx, cy)
  })
}

/** Whether clicking `hit` inside the selection selects it: not when a selected group holds it. */
export function clickSelectsInside(hit: SceneNode, editor: Editor) {
  for (let node = editor.graph.getNode(hit.parentId ?? ''); node;) {
    if (editor.state.selectedIds.has(node.id)) {
      return node.type !== 'GROUP' && node.type !== 'BOOLEAN_OPERATION'
    }
    node = editor.graph.getNode(node.parentId ?? '')
  }
  return false
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
    if (isLockedInTree(selectedId, editor)) continue
    const id = autoLayoutMoveTarget(selectedId, editor)
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
    appliedDx: 0,
    appliedDy: 0,
    startScreenX: sx,
    startScreenY: sy,
    dragStarted: false,
    originals,
    autoLayoutParentId: detectDragAutoLayoutParent(originals, editor)
  }
}
