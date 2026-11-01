import { resolveEditorProfile, type Editor, type MovePlace } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'

import { duplicateAndDrag } from '#vue/shared/input/duplicate-drag'
import { collectFlowDrags } from '#vue/shared/input/flow-reorder'
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
 * selected layer that a click does not look into, or a selected layer under the point lies inside
 * the hit group or boolean. A selected top-level frame or section stays open, so its layers are
 * selected by the press as they are when it is not selected.
 */
/** Whether a selected frame, not a group or boolean, holds `hit`; a read-only press selects it then. */
function insideSelectedFrame(hit: SceneNode, editor: Editor) {
  for (let node = editor.graph.getNode(hit.parentId ?? ''); node;) {
    if (editor.state.selectedIds.has(node.id)) {
      return node.type !== 'GROUP' && node.type !== 'BOOLEAN_OPERATION'
    }
    node = editor.graph.getNode(node.parentId ?? '')
  }
  return false
}

function pressesSelection(hit: SceneNode, cx: number, cy: number, editor: Editor) {
  return [...editor.state.selectedIds].some((id) => {
    if (id === hit.id) return false
    if (editor.graph.isDescendant(hit.id, id)) return !editor.graph.isOpenContainer(id)
    return editor.graph.isDescendant(id, hit.id) && editor.graph.isPointInNode(id, cx, cy)
  })
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

/** Whether a connector holds onto a layer at either end. */
function joinsLayer(node: SceneNode) {
  return (
    node.type === 'CONNECTOR' && [node.connectorStart, node.connectorEnd].some((end) => end?.nodeId)
  )
}

function collectMoveOriginals(editor: Editor) {
  const originals = new Map<string, MovePlace>()
  for (const selectedId of editor.state.selectedIds) {
    if (isLockedInTree(selectedId, editor)) continue
    const id = autoLayoutMoveTarget(selectedId, editor)
    const node = editor.graph.getNode(id)
    if (node) {
      const parentId = node.parentId ?? editor.state.currentPageId
      originals.set(id, {
        x: node.x,
        y: node.y,
        parentId,
        index: editor.graph.getNode(parentId)?.childIds.indexOf(id)
      })
    }
  }
  // FigJam moves a connector held by a layer only along with other layers; dragged alone, it
  // stays put.
  const [only] = originals.keys()
  const lone = originals.size === 1 ? editor.graph.getNode(only) : undefined
  if (lone && joinsLayer(lone)) originals.clear()
  return originals
}

function detectDragAutoLayoutParent(originals: Map<string, MovePlace>, editor: Editor) {
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
    autoLayoutParentId: detectDragAutoLayoutParent(originals, editor),
    flows: collectFlowDrags(originals, editor)
  }
}

/**
 * Whether a press on `hit` selects it rather than acting on the selection it lies in, as in
 * Figma: a press inside a selected frame drags the frame, a deep (⌘) press selects what it hit,
 * and a read-only document, where nothing drags, selects the layer inside a selected frame.
 */
export function pressSelects(
  hit: SceneNode,
  cx: number,
  cy: number,
  editor: Editor,
  deep = false
): boolean {
  if (deep || !pressesSelection(hit, cx, cy, editor)) return true
  return !resolveEditorProfile(editor.state).edits && insideSelectedFrame(hit, editor)
}
