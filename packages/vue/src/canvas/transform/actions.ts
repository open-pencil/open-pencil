import type { Editor } from '@open-pencil/core/editor'

import { handleMarqueeMove as handleMarqueeMoveAction } from '#vue/canvas/transform/marquee'
import { handlePanMove as handlePanMoveAction } from '#vue/canvas/transform/pan'
import {
  handleRotateMove as handleRotateMoveAction,
  tryStartRotation as tryStartRotationAction
} from '#vue/canvas/transform/rotation'
import { handleTextSelectMove as handleTextSelectMoveAction } from '#vue/canvas/transform/text-selection'
import type { DragMarquee, DragPan, DragRotate, DragState } from '#vue/shared/input/types'

type SetDrag = (drag: DragState) => void

export function createTransformInputActions(editor: Editor, setDrag: SetDrag) {
  function tryStartRotation(cx: number, cy: number): boolean {
    return tryStartRotationAction(editor, setDrag, cx, cy)
  }

  function handlePanMove(d: DragPan, e: MouseEvent) {
    handlePanMoveAction(editor, d, e)
  }

  function handleRotateMove(d: DragRotate, sx: number, sy: number, shiftKey: boolean) {
    handleRotateMoveAction(editor, d, sx, sy, shiftKey)
  }

  function handleTextSelectMove(cx: number, cy: number) {
    handleTextSelectMoveAction(editor, cx, cy)
  }

  function handleMarqueeMove(d: DragMarquee, cx: number, cy: number) {
    handleMarqueeMoveAction(editor, d, cx, cy)
  }

  return {
    tryStartRotation,
    handlePanMove,
    handleRotateMove,
    handleTextSelectMove,
    handleMarqueeMove
  }
}
