import { createTransformInputActions } from '#vue/canvas/transform-input/actions'

import type { DragState } from '#vue/shared/input/types'
import type { Editor } from '@open-pencil/core/editor'

type CanvasToLocal = (cx: number, cy: number, scopeId: string) => { lx: number; ly: number }
type SetDrag = (drag: DragState) => void

export function createCanvasTransformInput(
  editor: Editor,
  canvasToLocal: CanvasToLocal,
  setDrag: SetDrag
) {
  return createTransformInputActions(editor, canvasToLocal, setDrag)
}
