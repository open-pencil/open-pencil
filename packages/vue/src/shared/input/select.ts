import { getNodeEditState, handleNodeEditDown } from '#vue/shared/input/node-edit'
export { resolveHit } from '#vue/shared/input/select/hit'
import { resolveHit } from '#vue/shared/input/select/hit'
export { updateHoverCursor } from '#vue/shared/input/select/hover'
import { createSelectionMoveDrag, selectionIsLocked } from '#vue/shared/input/select/move'
import { tryStartResize } from '#vue/shared/input/resize'

import type { DragState } from '#vue/shared/input/types'
import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/core/scene-graph'

export interface HitTestFns {
  hitTestInScope: (cx: number, cy: number, deep: boolean) => SceneNode | null
  isInsideContainerBounds: (cx: number, cy: number, containerId: string) => boolean
  hitTestSectionTitle: (cx: number, cy: number) => SceneNode | null
  hitTestComponentLabel: (cx: number, cy: number) => SceneNode | null
  hitTestFrameTitle: (cx: number, cy: number) => SceneNode | null
}

export function handleSelectDown(
  e: MouseEvent,
  cx: number,
  cy: number,
  editor: Editor,
  fns: HitTestFns,
  tryStartRotation: (cx: number, cy: number) => boolean,
  handleTextEditClick: (cx: number, cy: number, shiftKey: boolean) => boolean,
  setDrag: (d: DragState) => void
) {
  // Node edit mode intercept
  if (getNodeEditState(editor)) {
    handleNodeEditDown(e, cx, cy, editor, setDrag)
    return
  }

  if (editor.state.editingTextId && handleTextEditClick(cx, cy, e.shiftKey)) return

  if (editor.state.editingTextId) editor.commitTextEdit()

  if (tryStartRotation(cx, cy)) return

  const resizeDrag = tryStartResize(cx, cy, editor)
  if (resizeDrag) {
    setDrag(resizeDrag)
    return
  }

  const hit = resolveHit(cx, cy, editor, fns)
  if (!hit) {
    if (!editor.state.enteredContainerId) {
      editor.clearSelection()
      setDrag({ type: 'marquee', startX: cx, startY: cy })
    }
    return
  }

  if (!editor.state.selectedIds.has(hit.id) && !e.shiftKey) {
    editor.select([hit.id])
  } else if (e.shiftKey) {
    editor.select([hit.id], true)
  }

  if (selectionIsLocked(editor)) return

  setDrag(createSelectionMoveDrag(cx, cy, editor, e.altKey))
}

