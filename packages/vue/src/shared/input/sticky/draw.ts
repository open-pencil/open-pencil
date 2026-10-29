import { toRaw } from 'vue'

import type { Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'
import { STICKY_SIZE, stickySublayers } from '@open-pencil/scene-graph/generated'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import { scaleNodeChanges } from '@open-pencil/scene-graph/scaling'

import { parentSpace } from '#vue/shared/input/draw'
import { findDrawParent } from '#vue/shared/input/drop-target'
import { subtree } from '#vue/shared/input/sticky/scale'
import type { DragState, DragStickyDraw } from '#vue/shared/input/types'

/** A drag shorter than this either way is a click, as for a drawn frame. */
const CLICK_SIZE = 2

/**
 * Draws a note as a frame is drawn: it appears at the press and grows with the drag from that
 * corner, its text and padding scaling with it since a note keeps its square shape. A click
 * places a note of the default size with its corner there. Release types into it.
 */
export function startStickyDraw(
  cx: number,
  cy: number,
  editor: Editor,
  setDrag: (d: DragState) => void
) {
  editor.undo.beginBatch('Create sticky')
  const parentId = findDrawParent(cx, cy, 'STICKY', editor)
  const toLocal = parentSpace(editor, parentId)
  const snap = editor.state.snappingPreferences.pixelGrid ? Math.round : (value: number) => value
  const local = toLocal(cx, cy)
  const start = { x: snap(local.x), y: snap(local.y) }
  const sticky = editor.createStickyNote(parentId, {
    x: start.x + STICKY_SIZE / 2,
    y: start.y + STICKY_SIZE / 2
  })
  const originals = subtree(editor, sticky)
  const graph = editor.graph
  let size = 0
  let finished = false

  /** Shows the note at `side` from the press corner towards `toward`. */
  function show(side: number, toward: Vector) {
    const scale = Math.max(side, 1) / STICKY_SIZE
    const extent = STICKY_SIZE * scale
    const position = {
      x: toward.x < start.x ? start.x - extent : start.x,
      y: toward.y < start.y ? start.y - extent : start.y
    }
    for (const [id, original] of originals) {
      const changes: Partial<SceneNode> = scaleNodeChanges(original, scale, id !== sticky.id)
      if (id === sticky.id) Object.assign(changes, position)
      graph.updateNodePreview(id, changes)
    }
    editor.requestRepaint()
    return { scale, position }
  }

  let shown = show(0, start)

  function restore() {
    for (const [id, original] of originals) {
      const changes: Partial<SceneNode> = scaleNodeChanges(original, 1, id !== sticky.id)
      if (id === sticky.id) Object.assign(changes, { x: original.x, y: original.y })
      graph.updateNodePreview(id, changes)
    }
  }

  const drag: DragStickyDraw = {
    type: 'sticky-draw',
    move(x, y) {
      const point = toLocal(x, y)
      const toward = { x: snap(point.x), y: snap(point.y) }
      size = Math.max(Math.abs(toward.x - start.x), Math.abs(toward.y - start.y))
      shown = show(size, toward)
    },
    commit() {
      if (finished) return
      finished = true
      restore()
      if (editor.graph !== graph) {
        editor.undo.rollbackBatch()
        return
      }
      // A click keeps the note as it was made: the default size, its corner at the click.
      if (size >= CLICK_SIZE) editor.scaleStickyNote(sticky.id, shown.scale, shown.position)
      editor.undo.commitBatch()
      editor.setTool('SELECT')
      const body = stickySublayers(graph, toRaw(sticky))?.body
      if (body) editor.startTextEditing(body.id)
    },
    cancel() {
      if (finished) return
      finished = true
      restore()
      if (editor.graph === graph) editor.undo.rollbackBatch()
      editor.requestRender()
    }
  }
  setDrag(drag)
}
