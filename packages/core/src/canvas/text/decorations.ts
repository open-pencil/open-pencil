import type { Canvas, CanvasKit, Paint } from 'canvaskit-wasm'

import type { Fill, SceneNode } from '@open-pencil/scene-graph'
import { resolveRGBAForPreview } from '@open-pencil/scene-graph/color'

import type { TextLayout } from '#core/canvas/text/layout'
import { styleRunColor } from '#core/canvas/text/paragraph'
import { laidOutGlyphs, type LaidOutGlyph } from '#core/canvas/text/placed'
import type { PreparedText } from '#core/canvas/text/preparation/cache'
import { shownCharacters, shownText } from '#core/text/case'
import {
  hasDecoration,
  textDecorationRects,
  type DecoratedGlyph,
  type TextDecorationRect
} from '#core/text/decorations'
import { outlineInk } from '#core/text/ink'
import { COMBINING_KEYCAP } from '#core/text/keycap'

import { drawKeycapFrame } from './keycap'

/** Laid-out glyphs, whose ink comes from their font when it drew them. */
export function laidOutDecoratedGlyphs(glyphs: readonly LaidOutGlyph[]): DecoratedGlyph[] {
  return glyphs.map((glyph) => ({
    x: glyph.x,
    y: glyph.y,
    firstCharacter: glyph.firstCharacter,
    advance: glyph.advance,
    ink: (top, bottom) => {
      const commands = glyph.source?.outline(glyph.id, glyph.fontSize)
      return commands ? outlineInk(commands, glyph.x, glyph.y, top, bottom) : null
    }
  }))
}

function solidColor(fills: Fill[]): Fill | undefined {
  return fills.find((fill) => fill.visible && fill.type === 'SOLID')
}

/** Dots one diameter apart, drawn as one run of round points so a line is one call. */
function drawDots(ck: CanvasKit, canvas: Canvas, rect: TextDecorationRect, paint: Paint) {
  // A line of no thickness has no dots; stepping by it would never end.
  if (rect.height <= 0) return
  const radius = rect.height / 2
  const y = rect.y + radius
  const points: number[] = []
  for (let x = rect.x + radius; x <= rect.x + rect.width - radius; x += rect.height * 2) {
    points.push(x, y)
  }
  if (points.length === 0) return
  paint.setStyle(ck.PaintStyle.Stroke)
  paint.setStrokeCap(ck.StrokeCap.Round)
  paint.setStrokeWidth(rect.height)
  canvas.drawPoints(ck.PointMode.Points, points, paint)
}

function drawWave(ck: CanvasKit, canvas: Canvas, rect: TextDecorationRect, paint: Paint) {
  // A cosine through the rect's middle that starts in a trough, as Figma draws it.
  const amplitude = rect.height / 2
  const period = rect.height * 3.5
  const y = rect.y + rect.height / 2
  const step = Math.max(0.25, period / 32)
  const path = new ck.PathBuilder()
  path.moveTo(rect.x, y + amplitude)
  for (let x = rect.x + step; x < rect.x + rect.width; x += step) {
    path.lineTo(x, y + amplitude * Math.cos(((x - rect.x) / period) * Math.PI * 2))
  }
  const end = rect.x + rect.width
  path.lineTo(end, y + amplitude * Math.cos(((end - rect.x) / period) * Math.PI * 2))
  const wave = path.detachAndDelete()
  paint.setStyle(ck.PaintStyle.Stroke)
  paint.setStrokeWidth((rect.height * 2) / 3)
  canvas.drawPath(wave, paint)
  wave.delete()
}

/** Draws decorations in their own paints, or in `textPaint` where the text's has no colour. */
export function drawTextDecorations(
  ck: CanvasKit,
  canvas: Canvas,
  rects: readonly TextDecorationRect[],
  textPaint: Paint
): void {
  for (const rect of rects) {
    const fill = solidColor(rect.fills)
    const paint = textPaint.copy()
    try {
      paint.setAntiAlias(true)
      paint.setStyle(ck.PaintStyle.Fill)
      if (fill?.type === 'SOLID') {
        const { r: red, g, b, a } = resolveRGBAForPreview(fill.color).color
        paint.setShader(null)
        paint.setColorComponents(red, g, b, a * fill.opacity)
      }
      if (rect.style === 'DOTTED') drawDots(ck, canvas, rect, paint)
      else if (rect.style === 'WAVY') drawWave(ck, canvas, rect, paint)
      else canvas.drawRect(ck.XYWHRect(rect.x, rect.y, rect.width, rect.height), paint)
    } finally {
      paint.delete()
    }
  }
}

/**
 * Draws laid-out text and its decorations, `y` below the node's top. The decorations are kept
 * with the prepared text, which its cache replaces when an input of the text changes.
 */
/** The frames of the text's keycaps, which its layout leaves to be drawn, in their text's colour. */
function drawKeycapFrames(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  layout: TextLayout,
  y: number,
  paint: Paint
): void {
  const text = shownText(node)
  if (!text.includes(COMBINING_KEYCAP)) return
  // Style runs index the source text, which a case such as `ß` to `SS` makes shorter.
  const sourceIndexAt = new Map<number, number>()
  let shownIndex = 0
  for (const { character, sourceIndex } of shownCharacters(node)) {
    sourceIndexAt.set(shownIndex, sourceIndex)
    shownIndex += character.length
  }
  const runPaint = paint.copy()
  try {
    for (const glyph of laidOutGlyphs(node, layout, text, y) ?? []) {
      const character = glyph.firstCharacter
      if (character === undefined || text[character] !== COMBINING_KEYCAP) continue
      // The frame takes the colour the paragraph gives its mark: its style run's, if it has one.
      const source = sourceIndexAt.get(character) ?? character
      const run = node.styleRuns.find(
        (item) => source >= item.start && source < item.start + item.length
      )
      runPaint.setColor(run ? styleRunColor(ck, run.style, paint.getColor()) : paint.getColor())
      drawKeycapFrame(ck, canvas, glyph.x, glyph.y, glyph.fontSize, runPaint)
    }
  } finally {
    runPaint.delete()
  }
}

export function drawTextLayout(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  prepared: PreparedText,
  y: number,
  textPaint: Paint
): void {
  const layout = prepared.paragraph
  layout.draw(canvas, 0, y)
  drawKeycapFrames(ck, canvas, node, layout, y, textPaint)
  if (!hasDecoration(node)) return
  if (prepared.decorations?.y !== y) {
    const glyphs = laidOutGlyphs(node, layout, shownText(node), y)
    const rects = glyphs ? textDecorationRects(node, laidOutDecoratedGlyphs(glyphs)) : []
    prepared.decorations = { y, rects }
  }
  drawTextDecorations(ck, canvas, prepared.decorations.rects, textPaint)
}
