import type { Canvas } from 'canvaskit-wasm'

import type { SceneNode } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { TEXT_CARET_COLOR, TEXT_CARET_WIDTH, TEXT_SELECTION_COLOR } from '#core/constants'
import type { TextEditor } from '#core/text/editor'

export function drawTextEditOverlay(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  editor: TextEditor
): void {
  // Path text lays the paragraph out flat and then maps each glyph onto the
  // path. The flat caret / selection rects are in that flat space, so painting
  // them drops axis-aligned boxes over the artwork that have nothing to do with
  // the on-path glyphs. Draw an on-path caret instead (the curved selection band
  // + path stay visible via drawSelection).
  if (node.source.fig.kiwiNodeType === 'TEXT_PATH') {
    drawPathTextCaret(r, canvas, node, editor)
    return
  }

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

/**
 * Caret for text on a path: a tick standing perpendicular to the curve at the
 * insertion glyph (baseline → ~cap height), so the cursor sits on the lettering
 * instead of at the flat-layout position. Blinks with `caretVisible`.
 */
function drawPathTextCaret(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  editor: TextEditor
): void {
  if (!editor.caretVisible || editor.hasSelection()) return
  const glyphs = node.figmaDerivedTextGlyphs
  const idx = editor.caretIndex
  if (!glyphs?.length || idx == null) return
  const g = glyphs[Math.min(Math.max(idx, 0), glyphs.length - 1)]
  const fontSize = g.fontSize || 0
  if (fontSize <= 0) return
  const rot = g.rotation ?? 0
  // Ascender ("up") direction from the glyph's on-path rotation.
  const ux = -Math.sin(rot)
  const uy = -Math.cos(rot)
  r.auxStroke.setStrokeWidth((TEXT_CARET_WIDTH * 1.5) / r.zoom)
  r.auxStroke.setColor(r.selColor())
  r.auxStroke.setPathEffect(null)
  canvas.drawLine(g.x, g.y, g.x + ux * fontSize * 0.72, g.y + uy * fontSize * 0.72, r.auxStroke)
}
