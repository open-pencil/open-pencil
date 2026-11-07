import type { Ref } from 'vue'

import type { Editor } from '@open-pencil/core'
import { PEN_CLOSE_MIN_POINTS, PEN_CLOSE_THRESHOLD } from '@open-pencil/core/constants'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { createPenDrag, handlePenDragMove } from '#vue/canvas/pen/drag'
import { PEN_CURSOR } from '#vue/editor/tool-cursor'
import { resolveVertexSnap } from '#vue/shared/input/snap'
import type { DragState } from '#vue/shared/input/types'
import { handlePenNodeEditDown } from '#vue/shared/input/vector'

type SetDrag = (drag: DragState) => void

/** Whether a canvas point lies within the close threshold, in screen pixels, of a path's point. */
function nearVertex(cx: number, cy: number, vertex: Vector, editor: Editor) {
  const zoom = editor.renderer?.zoom ?? 1
  return Math.hypot(cx - vertex.x, cy - vertex.y) < PEN_CLOSE_THRESHOLD / zoom
}

/**
 * The vertices the pen's next point lines up with, which in Figma are only the path's own: the
 * path being drawn with the one it continues, or the path being edited before the pen picks it up.
 */
function penSnapVertices(editor: Editor): readonly Vector[] {
  const penState = editor.state.penState
  if (!penState) return editor.state.nodeEditState?.vertices ?? []
  const resumed = penState.resumedPath?.network.vertices ?? []
  return [...resumed, ...penState.vertices]
}

export function startPenInput(
  e: Pick<MouseEvent, 'altKey'>,
  cx: number,
  cy: number,
  editor: Editor,
  setDrag: SetDrag,
  cursorOverride: Ref<string | null>
): boolean {
  editor.state.penCursorX = null
  editor.state.penCursorY = null

  const { point } = resolveVertexSnap({ x: cx, y: cy }, penSnapVertices(editor), editor)
  editor.setSnapGuides([])
  if (editor.state.nodeEditState) {
    handlePenNodeEditDown(e, cx, cy, editor, point)
    return true
  }

  const press = { x: cx, y: cy }
  const penState = editor.state.penState
  if (penState && penState.vertices.length >= PEN_CLOSE_MIN_POINTS) {
    const first = penState.vertices[0]
    if (nearVertex(cx, cy, first, editor)) {
      editor.penSetPendingClose(true)
      editor.penSetClosingToFirst(true)
      setDrag(createPenDrag(first, press))
      cursorOverride.value = PEN_CURSOR
      return true
    }
  }

  // A press back on the last point drags its outgoing handle out again and keeps the one into it,
  // rather than stacking a point there (Figma).
  const last = penState?.vertices.at(-1)
  if (penState && last && nearVertex(cx, cy, last, editor)) {
    editor.penSetPendingClose(false)
    setDrag(createPenDrag(last, press, penState.segments.at(-1)?.tangentEnd ?? { x: 0, y: 0 }))
    cursorOverride.value = PEN_CURSOR
    return true
  }

  editor.penSetPendingClose(false)
  editor.penAddVertex(point.x, point.y)
  setDrag(createPenDrag(point, press))
  cursorOverride.value = PEN_CURSOR
  return true
}

export function updatePenHover(cx: number, cy: number, editor: Editor): boolean {
  if (editor.state.activeTool !== 'PEN') return false
  if (!editor.state.penState && !editor.state.nodeEditState) return false
  const snap = resolveVertexSnap({ x: cx, y: cy }, penSnapVertices(editor), editor)
  editor.setSnapGuides(snap.guides)
  if (!editor.state.penState) return true
  editor.state.penCursorX = snap.point.x
  editor.state.penCursorY = snap.point.y

  const first = editor.state.penState.vertices[0]
  if (editor.state.penState.vertices.length >= PEN_CLOSE_MIN_POINTS) {
    editor.penSetClosingToFirst(nearVertex(cx, cy, first, editor))
  }
  editor.requestRepaint()
  return true
}

export { handlePenDragMove }
