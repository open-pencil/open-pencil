import type { Editor } from '@open-pencil/core'
import { slideDropAt, type SlideDrop } from '@open-pencil/scene-graph/slides'

import { isPastPointerDragThreshold } from '#vue/shared/input/drag-threshold'
import type { DragSlides } from '#vue/shared/input/types'

/** Whether a press on the grid drags slides: every selected layer is a slide, and none is staged. */
export function selectionIsSlides(editor: Editor): boolean {
  if (editor.state.focusedSlideId !== null || editor.state.selectedIds.size === 0) return false
  return [...editor.state.selectedIds].every((id) => editor.graph.getNode(id)?.type === 'SLIDE')
}

/**
 * Drags the selected slides through the deck's grid, as in Figma: they stay put while a line shows
 * where they land, beside a slide or as a new section between rows, and the drop moves them there
 * as one undo step.
 */
export function createSlidesDrag(
  editor: Editor,
  startX: number,
  startY: number,
  /** A selected slide Shift-pressed, which a press without a drag deselects. */
  clickDeselectsId?: string
): DragSlides {
  const ids = [...editor.state.selectedIds]
  let started = false
  let drop: SlideDrop | null = null
  const clear = () => editor.setLayoutInsertIndicator(null)
  return {
    type: 'slides',
    update(canvasX, canvasY, screenX, screenY) {
      if (!started && !isPastPointerDragThreshold(startX, startY, screenX, screenY)) return
      started = true
      drop = slideDropAt(editor.graph, editor.state.currentPageId, { x: canvasX, y: canvasY })
      // Only the line is drawn; the page stands in for the parent a layer drag would name.
      editor.setLayoutInsertIndicator(
        drop ? { parentId: editor.state.currentPageId, index: 0, ...drop.line } : null
      )
    },
    commit() {
      clear()
      if (drop) editor.moveSlides(ids, drop.placement)
      else if (!started && clickDeselectsId) editor.select([clickDeselectsId], true)
    },
    cancel: clear
  }
}
