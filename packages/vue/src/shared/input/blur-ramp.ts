import {
  blurRampHandleAt,
  editedBlurRamp,
  editedBlurRampLayout,
  type Editor
} from '@open-pencil/core'
import { createSceneGeometry } from '@open-pencil/core/geometry'
import type { Effect } from '@open-pencil/scene-graph'

import type { DragBlurRamp, DragState } from '#vue/shared/input/types'

/**
 * Starts dragging the start or end of the progressive blur whose settings are open, if one is
 * under the pointer. The point follows the pointer, rounded to whole pixels of the layer as in
 * Figma desktop 126, and each drag is one undo step.
 */
export function tryStartBlurRampDrag(
  editor: Editor,
  sx: number,
  sy: number,
  setDrag: (drag: DragState) => void
): boolean {
  const edit = editor.state.blurRampEdit
  const edited = editedBlurRamp(editor.graph, edit)
  const layout = editedBlurRampLayout(editor.graph, edit, editor.state)
  if (!edit || !edited || !layout) return false
  const handle = blurRampHandleAt(layout, { x: sx, y: sy })
  if (!handle) return false
  const { node } = edited
  const { index } = edit
  const original: Effect = structuredClone(edited.effect)
  const preview = editor.beginNodePreview('Edit progressive blur')

  function update(screenX: number, screenY: number) {
    const current = editor.graph.getNode(node.id)
    const progressive = original.progressive
    if (!current || !progressive || current.width === 0 || current.height === 0) return
    const local = createSceneGeometry(editor.graph).screenToLocal(
      current,
      { x: screenX, y: screenY },
      editor.state
    )
    if (!local) return
    const offset = {
      x: Math.round(local.x) / current.width,
      y: Math.round(local.y) / current.height
    }
    const moved: Effect = {
      ...original,
      progressive: {
        ...progressive,
        [handle === 'start' ? 'startOffset' : 'endOffset']: offset
      }
    }
    preview.update(node.id, {
      effects: current.effects.map((effect, at) => (at === index ? moved : effect))
    })
  }

  const drag: DragBlurRamp = {
    type: 'blur-ramp',
    update,
    commit: () => preview.commit(),
    cancel: () => preview.cancel()
  }
  setDrag(drag)
  return true
}
