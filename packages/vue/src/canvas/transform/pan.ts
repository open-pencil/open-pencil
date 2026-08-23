import type { Editor } from '@open-pencil/core/editor'

import type { DragPan } from '#vue/shared/input/types'

export function handlePanMove(editor: Editor, d: DragPan, event: MouseEvent) {
  const dx = event.clientX - d.startScreenX
  const dy = event.clientY - d.startScreenY
  editor.state.panX = d.startPanX + dx
  editor.state.panY = d.startPanY + dy
  editor.requestRepaint()
}
