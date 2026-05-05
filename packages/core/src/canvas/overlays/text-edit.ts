import type { Canvas } from 'canvaskit-wasm'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { TEXT_CARET_COLOR, TEXT_CARET_WIDTH, TEXT_SELECTION_COLOR } from '#core/constants'
import type { SceneNode } from '#core/scene-graph'
import type { TextEditor } from '#core/text/editor'

export function drawTextEditOverlay(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  editor: TextEditor
): void {
  r.auxStroke.setStrokeWidth(1 / r.zoom)
  r.auxStroke.setColor(r.selColor())
  r.auxStroke.setPathEffect(null)
  canvas.drawRect(r.ck.LTRBRect(0, 0, node.width, node.height), r.auxStroke)

  const selRects = editor.getSelectionRects()
  if (selRects.length > 0) {
    r.auxFill.setColor(
      r.ck.Color4f(
        TEXT_SELECTION_COLOR.r,
        TEXT_SELECTION_COLOR.g,
        TEXT_SELECTION_COLOR.b,
        TEXT_SELECTION_COLOR.a
      )
    )
    for (const sel of selRects) {
      canvas.drawRect(r.ck.LTRBRect(sel.x, sel.y, sel.x + sel.width, sel.y + sel.height), r.auxFill)
    }
  }

  if (editor.caretVisible && !editor.hasSelection()) {
    const caret = editor.getCaretRect()
    if (caret) {
      r.auxFill.setColor(
        r.ck.Color4f(TEXT_CARET_COLOR.r, TEXT_CARET_COLOR.g, TEXT_CARET_COLOR.b, TEXT_CARET_COLOR.a)
      )
      const w = TEXT_CARET_WIDTH / r.zoom
      canvas.drawRect(
        r.ck.LTRBRect(caret.x - w / 2, caret.y0, caret.x + w / 2, caret.y1),
        r.auxFill
      )
    }
  }
}
