import { editedGradient, editedGradientLayout, type Editor } from '@open-pencil/core/editor'
import {
  createSceneGeometry,
  gradientStopPosition,
  hitTestGradientHandles,
  moveGradientHandle
} from '@open-pencil/core/geometry'
import type { Fill } from '@open-pencil/scene-graph'

import type { DragGradient, DragState } from '#vue/shared/input/types'

/**
 * Starts dragging a handle or stop of the gradient whose picker is open, if one is under the
 * pointer. Handles move exactly with the pointer, Shift turns them in 15° steps, and a stop slides
 * along the line or around the ellipse; each drag is one undo step, as in Figma desktop 126.
 */
export function tryStartGradientDrag(
  editor: Editor,
  sx: number,
  sy: number,
  setDrag: (drag: DragState) => void
): boolean {
  const edit = editor.state.gradientEdit
  const edited = editedGradient(editor.graph, edit)
  const layout = editedGradientLayout(editor.graph, edit, editor.state)
  if (!edit || !edited || !layout) return false
  const found = hitTestGradientHandles(layout, { x: sx, y: sy })
  if (!found) return false
  const hit = found
  const { paint: paintKey, index: paintIndex } = edit

  const { node, type } = edited
  const original: Fill = structuredClone(edited.paint)
  const originalStop = edit.stop
  if (hit.kind === 'stop') editor.state.gradientEdit = { ...edit, stop: hit.index }
  const preview = editor.beginNodePreview('Edit gradient')

  function paintsWith(paint: Fill): Fill[] {
    const paints = editor.graph.getNode(node.id)?.[paintKey] ?? []
    return paints.map((current, index) => (index === paintIndex ? paint : current))
  }

  function update(screenX: number, screenY: number, shiftKey: boolean) {
    const current = editor.graph.getNode(node.id)
    const transform = original.gradientTransform
    if (!current || !transform) return
    const local = createSceneGeometry(editor.graph).screenToLocal(
      current,
      { x: screenX, y: screenY },
      editor.state
    )
    if (!local) return
    if (hit.kind === 'handle') {
      const moved = moveGradientHandle(
        type,
        transform,
        current.width,
        current.height,
        hit.handle,
        local,
        shiftKey
      )
      preview.update(node.id, {
        [paintKey]: paintsWith({ ...original, gradientTransform: moved })
      })
      return
    }
    const position = gradientStopPosition(type, transform, current.width, current.height, local)
    const moving = original.gradientStops?.[hit.index]
    if (!moving) return
    // Stops stay in order, so the moved one may change places with its neighbours.
    const stops = (original.gradientStops ?? [])
      .map((stop, index) => (index === hit.index ? { ...stop, position } : stop))
      .map((stop, index) => ({ stop, index }))
      .sort((a, b) => a.stop.position - b.stop.position)
    const stop = stops.findIndex((entry) => entry.index === hit.index)
    preview.update(node.id, {
      [paintKey]: paintsWith({ ...original, gradientStops: stops.map((entry) => entry.stop) })
    })
    const latest = editor.state.gradientEdit
    if (latest) editor.state.gradientEdit = { ...latest, stop }
  }

  const drag: DragGradient = {
    type: 'gradient',
    update,
    commit: () => preview.commit(),
    cancel: () => {
      preview.cancel()
      const latest = editor.state.gradientEdit
      if (latest) editor.state.gradientEdit = { ...latest, stop: originalStop }
    }
  }
  setDrag(drag)
  return true
}
