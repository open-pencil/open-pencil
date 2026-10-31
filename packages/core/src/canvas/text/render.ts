import type { Canvas } from 'canvaskit-wasm'

import type { Fill, SceneNode } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { textVerticalOffset, withTextParagraph } from '#core/canvas/text'
import { shownText } from '#core/text/case'
import { mayHoldEmoji } from '#core/text/emoji'

import { drawTextLayout } from './decorations'
import { canDrawSavedText, drawDerivedText, drawsSavedText } from './derived'
import { drawLaidOutEmoji, drawSavedEmoji } from './emoji'

export function hasOverflowPathTextPaint(node: SceneNode): boolean {
  return (
    node.textPathData != null &&
    ((node.derivedTextGlyphs?.length ?? 0) > 0 ||
      (Array.isArray(node.strokeGeometry) && node.strokeGeometry.length > 0))
  )
}

function hasComplexTextFill(fill?: Fill): boolean {
  return fill !== undefined && fill.type !== 'SOLID'
}

function drawPaintedText(r: SkiaRenderer, canvas: Canvas, node: SceneNode): boolean {
  if (!r.fontsLoaded || !r.fontProvider) return false
  // Apply the shader directly to native glyphs: coverage layers add another rounding pass.
  return withTextParagraph(
    r,
    node,
    r.ck.Color4f(0, 0, 0, 1),
    {
      halfLeading: true,
      foregroundPaint: r.fillPaint
    },
    (paragraph, prepared) => {
      const y = textVerticalOffset(node, paragraph.getHeight())
      drawTextLayout(r.ck, canvas, node, prepared, y, r.fillPaint)
      return true
    }
  )
}

function drawResolvedPathText(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  fontReadiness: ReturnType<SkiaRenderer['nodeFontReadiness']>,
  fill?: Fill
): boolean {
  return (
    // Resolving the exact face must not replace curved glyph placement with a straight paragraph.
    fontReadiness !== 'exhausted' &&
    node.textPathData !== null &&
    drawDerivedText(r, canvas, node, fill)
  )
}

/** Whether the text is drawn from the editor's own layout, which leaves its emoji to be drawn. */
function drawsLaidOutText(r: SkiaRenderer, node: SceneNode): boolean {
  if (!r.fontsLoaded || !r.fontProvider || node.textPathData !== null) return false
  const readiness = r.nodeFontReadiness(node)
  return readiness !== 'pending' && readiness !== 'exhausted' && mayHoldEmoji(shownText(node))
}

/**
 * The emoji of a text, once whatever fills it has: over its saved glyphs' placeholder squares, or
 * over the blank squares the editor's layout gives them.
 */
export function drawTextEmoji(r: SkiaRenderer, canvas: Canvas, node: SceneNode): void {
  const saved = drawsSavedText(node)
  if (!saved && !drawsLaidOutText(r, node)) return
  canvas.save()
  if (saved) drawSavedEmoji(r, canvas, node)
  else {
    // The paragraph the fills just drew with: its colour keys the prepared text, and a solid fill
    // leaves it on the fill paint, so no second paragraph is shaped for the emoji.
    const lastFill = node.fills.findLast((fill) => fill.visible)
    const color = hasComplexTextFill(lastFill) ? r.ck.Color4f(0, 0, 0, 1) : r.fillPaint.getColor()
    withTextParagraph(r, node, color, { halfLeading: true }, (paragraph) =>
      drawLaidOutEmoji(r, canvas, node, paragraph, textVerticalOffset(node, paragraph.getHeight()))
    )
  }
  canvas.restore()
}

function drawSavedText(r: SkiaRenderer, canvas: Canvas, node: SceneNode, fill?: Fill): boolean {
  return canDrawSavedText(node, fill) && drawDerivedText(r, canvas, node, fill)
}

export function renderText(r: SkiaRenderer, canvas: Canvas, node: SceneNode, fill?: Fill): void {
  const text = node.text
  if (!text) return

  canvas.save()

  if (drawSavedText(r, canvas, node, fill)) {
    canvas.restore()
    return
  }
  const fontReadiness = r.nodeFontReadiness(node)
  if (fontReadiness === 'pending') {
    canvas.restore()
    return
  }
  if (drawResolvedPathText(r, canvas, node, fontReadiness, fill)) {
    canvas.restore()
    return
  }
  if (fontReadiness === 'exhausted') {
    if (node.textPicture && r.isTextPictureCurrent(node)) {
      const pic = r.ck.MakePicture(node.textPicture)
      if (pic) {
        canvas.drawPicture(pic)
        pic.delete()
        canvas.restore()
        return
      }
    }
    if (drawDerivedText(r, canvas, node, fill)) {
      canvas.restore()
      return
    }
    canvas.restore()
    return
  }
  if (hasComplexTextFill(fill) && drawPaintedText(r, canvas, node)) {
    canvas.restore()
    return
  }
  if (r.fontsLoaded && r.fontProvider) {
    withTextParagraph(
      r,
      node,
      r.fillPaint.getColor(),
      { halfLeading: true },
      (paragraph, prepared) => {
        const paragraphY = textVerticalOffset(node, paragraph.getHeight())
        drawTextLayout(r.ck, canvas, node, prepared, paragraphY, r.fillPaint)
      }
    )
  } else if (r.textFont) {
    const fontSize = node.fontSize || r.DEFAULT_FONT_SIZE
    const paragraphY = textVerticalOffset(node, fontSize)
    canvas.drawText(shownText(node), 0, paragraphY + fontSize, r.fillPaint, r.textFont)
  }

  canvas.restore()
}
