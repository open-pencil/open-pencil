import type { Canvas, Paint } from '@open-pencil/canvaskit'
import type { CharacterStyleOverride, Fill, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { textVerticalOffset } from '@open-pencil/scene-graph/text'

import { makeFillPaint } from '#core/canvas/fills/paint'
import type { SkiaRenderer } from '#core/canvas/renderer/skia'
import { withTextParagraph } from '#core/canvas/text'
import { canDrawSavedText, drawDerivedText, drawsSavedText } from '#core/canvas/text/derived'
import { drawLaidOutEmoji, drawSavedEmoji } from '#core/canvas/text/emoji'
import type { ParagraphBuildOptions } from '#core/canvas/text/paint'
import { DEFAULT_FONT_SIZE } from '#core/constants'
import { shownText } from '#core/text/case'
import { mayHoldEmoji } from '#core/text/emoji'

import { drawTextLayout } from './decorations'

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

/**
 * A style run's own visible fills, which its characters draw in place of the layer's: none when
 * they are empty or all hidden, as Figma draws such a range, and undefined when it has no fills.
 */
function ownFills(style: CharacterStyleOverride): Fill[] | undefined {
  return style.fills?.filter((fill) => fill.visible)
}

function isPlainSolid(fill: Fill): boolean {
  return fill.type === 'SOLID' && (!fill.blendMode || fill.blendMode === 'NORMAL')
}

/**
 * Whether the text's style runs with fills of their own draw them apart from the layer's fills,
 * once, as Figma paints a range's fills in place of every fill of the layer. A run of one plain
 * solid fill on a text of one solid fill takes its colour in the layer's paragraph instead.
 */
function drawsRangesApart(node: SceneNode): boolean {
  let ownsFills = false
  for (const run of node.styleRuns) {
    const fills = ownFills(run.style)
    if (!fills) continue
    if (fills.length !== 1 || !fills.every(isPlainSolid)) return true
    ownsFills = true
  }
  if (!ownsFills) return false
  const layerFills = node.fills.filter((fill) => fill.visible)
  return layerFills.length !== 1 || layerFills.some((fill) => fill.type !== 'SOLID')
}

/** A paint that draws nothing, for the characters a pass leaves to another. */
function clearPaint(r: SkiaRenderer): Paint {
  const paint = new r.ck.Paint()
  paint.setColor(r.ck.TRANSPARENT)
  return paint
}

/**
 * Draws the characters of the style runs with fills of their own, one pass per fill, so a run's
 * fills stack as a layer's do; a gradient or an image spans the layer, as in Figma.
 */
function drawRangeFills(r: SkiaRenderer, canvas: Canvas, node: SceneNode, graph: SceneGraph): void {
  let passes = 0
  for (const run of node.styleRuns) passes = Math.max(passes, ownFills(run.style)?.length ?? 0)
  const clear = clearPaint(r)
  const paints = new Map<Fill, Paint | null>()
  const paintOf = (fill: Fill): Paint | null => {
    let paint = paints.get(fill)
    if (paint === undefined) {
      paint = makeFillPaint(r, fill, node, graph)
      paints.set(fill, paint)
    }
    return paint
  }
  try {
    for (let pass = 0; pass < passes; pass++) {
      const rangePaint = (style: CharacterStyleOverride) => {
        const fill = ownFills(style)?.[pass]
        return (fill && paintOf(fill)) ?? clear
      }
      withTextParagraph(
        r,
        node,
        r.ck.Color4f(0, 0, 0, 1),
        { halfLeading: true, foregroundPaint: clear, rangePaint },
        (paragraph) => paragraph.draw(canvas, 0, textVerticalOffset(node, paragraph.getHeight()))
      )
    }
  } finally {
    for (const paint of paints.values()) paint?.delete()
    clear.delete()
  }
}

/**
 * Draws the text in one fill of the layer: all of it, or, when its ranges draw apart, the
 * characters without fills of their own, which leaves those ranges to `drawTextRangeFills`.
 */
function drawLaidOutText(
  r: SkiaRenderer,
  node: SceneNode,
  draw: (options: ParagraphBuildOptions) => void
): void {
  if (!drawsRangesApart(node)) {
    draw({})
    return
  }
  const clear = clearPaint(r)
  try {
    draw({ rangePaint: (style) => (ownFills(style) ? clear : undefined) })
  } finally {
    clear.delete()
  }
}

function drawPaintedText(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  options: ParagraphBuildOptions
): void {
  // Apply the shader directly to native glyphs: coverage layers add another rounding pass.
  withTextParagraph(
    r,
    node,
    r.ck.Color4f(0, 0, 0, 1),
    {
      halfLeading: true,
      foregroundPaint: r.fillPaint,
      ...options
    },
    (paragraph, prepared) => {
      const y = textVerticalOffset(node, paragraph.getHeight())
      drawTextLayout(r.ck, canvas, node, prepared, y, r.fillPaint, r.documentColorSpace)
    }
  )
}

function drawColoredText(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  options: ParagraphBuildOptions
): void {
  withTextParagraph(
    r,
    node,
    r.fillPaint.getColor(),
    { halfLeading: true, ...options },
    (paragraph, prepared) => {
      const paragraphY = textVerticalOffset(node, paragraph.getHeight())
      drawTextLayout(r.ck, canvas, node, prepared, paragraphY, r.fillPaint, r.documentColorSpace)
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

/** Whether the text can be drawn from the editor's own layout rather than its saved glyphs. */
function laysOutText(r: SkiaRenderer, node: SceneNode): boolean {
  if (!r.fontsLoaded || !r.fontProvider || node.textPathData !== null) return false
  const readiness = r.nodeFontReadiness(node)
  // Edited text draws its paragraph even after its fonts gave up, so its emoji draw over it too.
  return readiness !== 'pending' && (readiness !== 'exhausted' || !drawsSaved(r, node))
}

/** Whether the text is drawn from the editor's own layout, which leaves its emoji to be drawn. */
function drawsLaidOutText(r: SkiaRenderer, node: SceneNode): boolean {
  return laysOutText(r, node) && mayHoldEmoji(shownText(node))
}

/**
 * The ranges of a text with fills of their own, once whatever fills of the layer could draw: the
 * layer's passes leave them out. Text without a visible fill draws nothing, ranges included, and
 * text drawn from its saved glyphs draws its ranges' colours with them.
 */
export function drawTextRangeFills(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph
): void {
  if (!drawsRangesApart(node) || !node.fills.some((fill) => fill.visible)) return
  if ((drawsSaved(r, node) && drawsSavedText(node)) || !laysOutText(r, node)) return
  canvas.save()
  drawRangeFills(r, canvas, node, graph)
  canvas.restore()
}

/**
 * The emoji of a text, once whatever fills it has: over its saved glyphs' placeholder squares, or
 * over the blank squares the editor's layout gives them.
 */
export function drawTextEmoji(r: SkiaRenderer, canvas: Canvas, node: SceneNode): void {
  const saved = drawsSaved(r, node) && drawsSavedText(node)
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

/**
 * Whether the text draws from its saved glyphs. Text whose fonts are all loaded lays out live, as
 * Figma lays text out with its own fonts, so an edit changes nothing but the characters; saved
 * glyphs stand in for a missing or substituted font and keep path text on its path. Not while the
 * text is edited either: the caret, selection, and hit testing follow the live layout.
 */
function drawsSaved(r: SkiaRenderer, node: SceneNode): boolean {
  const readiness = r.nodeFontReadiness(node)
  // Fonts still loading leave nothing else to draw, edited or not.
  if (readiness === 'pending') return true
  if (r.editingTextId === node.id) return false
  return node.textPathData !== null || readiness !== 'ready'
}

/** Whether every fill of the text draws its saved glyphs, on its path or for want of its fonts. */
export function drawsOnlySavedGlyphs(r: SkiaRenderer, node: SceneNode): boolean {
  return (node.derivedTextGlyphs?.length ?? 0) > 0 && drawsSaved(r, node) && drawsSavedText(node)
}

/** Whether a fill of the text draws its saved glyphs, while another may lay it out live. */
export function drawsSomeSavedGlyphs(r: SkiaRenderer, node: SceneNode): boolean {
  return (
    (node.derivedTextGlyphs?.length ?? 0) > 0 &&
    drawsSaved(r, node) &&
    node.fills.some((fill) => fill.visible && canDrawSavedText(node, fill))
  )
}

function drawSavedText(r: SkiaRenderer, canvas: Canvas, node: SceneNode, fill?: Fill): boolean {
  return (
    drawsSaved(r, node) && canDrawSavedText(node, fill) && drawDerivedText(r, canvas, node, fill)
  )
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
  if (fontReadiness === 'exhausted' && drawsSaved(r, node)) {
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
  if (r.fontsLoaded && r.fontProvider) {
    const painted = hasComplexTextFill(fill)
    drawLaidOutText(r, node, (options) =>
      painted
        ? drawPaintedText(r, canvas, node, options)
        : drawColoredText(r, canvas, node, options)
    )
  } else if (r.chromeFonts.text) {
    const fontSize = node.fontSize || DEFAULT_FONT_SIZE
    const paragraphY = textVerticalOffset(node, fontSize)
    canvas.drawText(shownText(node), 0, paragraphY + fontSize, r.fillPaint, r.chromeFonts.text)
  }

  canvas.restore()
}
