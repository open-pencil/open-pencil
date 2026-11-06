import type { Editor } from '@open-pencil/core'

import type { DragPan } from '#vue/shared/input/types'

export function handlePanMove(editor: Editor, d: DragPan, event: MouseEvent) {
  const dx = event.clientX - d.startScreenX
  const dy = event.clientY - d.startScreenY
  editor.state.panX = d.startPanX + dx
  editor.state.panY = d.startPanY + dy
  // Dragging is navigation too, so the renderer spends its moving budget instead of its idle
  // one while the viewport follows the pointer.
  editor.setNavigationPhase('pan', performance.now())
  editor.requestRepaint()
}
