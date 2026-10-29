import type { Canvas } from 'canvaskit-wasm'

import type { SceneNode } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { TEXT_CARET_COLOR, TEXT_CARET_WIDTH, TEXT_SELECTION_ALPHA } from '#core/constants'
import type { TextEditor } from '#core/text/editor'
import { previousGraphemeBoundary } from '#core/text/graphemes'

import { withScreenStroke } from './outline'

/**
 * The caret's colour at `index`, as Figma draws it: the fill of the character before the caret,
 * or of the first at the text's start, when that is one visible solid fill, with its opacity;
 * black for a gradient, several fills, or none. The layer's opacity leaves it be. Measured in
 * Figma desktop.
 */
export function textCaretColor(node: SceneNode, index: number): Color {
  const character = index > 0 ? previousGraphemeBoundary(node.text, index) : 0
  const run = node.styleRuns.find(
    (item) => character >= item.start && character < item.start + item.length
  )
  const visible = (run?.style.fills ?? node.fills).filter((fill) => fill.visible)
  const [fill] = visible
  if (visible.length !== 1 || fill.type !== 'SOLID') return TEXT_CARET_COLOR
  return { ...fill.color, a: fill.color.a * fill.opacity }
}

export function drawTextEditOverlay(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  editor: TextEditor,
  /** How far the outline sits outside the text, as around a connector label's plate. */
  outset = 0
): void {
  // Path text lays the paragraph out flat and then maps each glyph onto the
  // path. The flat caret / selection rects are in that flat space, so painting
  // them drops axis-aligned boxes over the artwork that have nothing to do with
  // the on-path glyphs. Draw an on-path caret instead (the curved selection band
  // + path stay visible via drawSelection).
  if (node.textPathData !== null) {
    drawPathTextCaret(r, canvas, node, editor)
    return
  }

  withScreenStroke(r, { color: r.selColor() }, (paint) =>
    canvas.drawRect(
      r.ck.LTRBRect(-outset, -outset, node.width + outset, node.height + outset),
      paint
    )
  )

  const selRects = editor.getSelectionRects()
  if (selRects.length > 0) {
    r.auxFill.setColor(r.selColor(TEXT_SELECTION_ALPHA))
    for (const sel of selRects) {
      canvas.drawRect(r.ck.LTRBRect(sel.x, sel.y, sel.x + sel.width, sel.y + sel.height), r.auxFill)
    }
  }

  if (editor.caretVisible && !editor.hasSelection()) {
    const caret = editor.getCaretRect()
    if (caret) {
      const color = textCaretColor(node, editor.caretIndex ?? 0)
      r.auxFill.setColor(r.ck.Color4f(color.r, color.g, color.b, color.a))
      const w = TEXT_CARET_WIDTH / r.zoom
      canvas.drawRect(
        r.ck.LTRBRect(caret.x - w / 2, caret.y0, caret.x + w / 2, caret.y1),
        r.auxFill
      )
    }
  }
}

/**
 * Text on a path while it is edited, as Figma draws it: the lettering outlined by the bounds of
 * its glyph boxes, the selection covering each selected glyph from the font's descent to its
 * ascent, turned with the glyph, and the caret square to the path between two characters over the
 * same height.
 */
function drawPathTextCaret(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  editor: TextEditor
): void {
  const corners = editor.getPathTextQuads().flat()
  if (corners.length > 0) {
    const xs = corners.map((point) => point.x)
    const ys = corners.map((point) => point.y)
    withScreenStroke(r, { color: r.selColor() }, (paint) =>
      canvas.drawRect(
        r.ck.LTRBRect(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)),
        paint
      )
    )
  }

  const quads = editor.getPathSelectionQuads()
  if (quads.length > 0) {
    // One path, so boxes overlapping where the path bends are not tinted twice.
    const builder = new r.ck.PathBuilder()
    for (const [first, ...rest] of quads) {
      builder.moveTo(first.x, first.y)
      for (const point of rest) builder.lineTo(point.x, point.y)
      builder.close()
    }
    const path = builder.detachAndDelete()
    r.auxFill.setColor(r.selColor(TEXT_SELECTION_ALPHA))
    canvas.drawPath(path, r.auxFill)
    path.delete()
  }

  if (!editor.caretVisible || editor.hasSelection()) return
  const caret = editor.getPathCaret()
  if (!caret) return
  r.auxStroke.setStrokeWidth(TEXT_CARET_WIDTH / r.zoom)
  const color = textCaretColor(node, editor.caretIndex ?? 0)
  r.auxStroke.setColor(r.ck.Color4f(color.r, color.g, color.b, color.a))
  r.auxStroke.setPathEffect(null)
  canvas.drawLine(caret.from.x, caret.from.y, caret.to.x, caret.to.y, r.auxStroke)
}
