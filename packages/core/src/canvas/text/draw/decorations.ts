import type { Canvas, CanvasKit, Paint } from '@open-pencil/canvaskit'
import type { ColorProfile, Fill, SceneNode, StyleRun } from '@open-pencil/scene-graph'
import { normalizeColor, toExtendedSRGB } from '@open-pencil/scene-graph/color'
import type { VisualBounds } from '@open-pencil/scene-graph/geometry'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { styleRunAt } from '@open-pencil/scene-graph/text'

import type { TextLayout } from '#core/canvas/text/layout'
import { drawnBaseline } from '#core/canvas/text/layout/lines'
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
  if (!hasDots(rect)) return
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

/** A wavy line's stroke, as a share of its rect's height. */
const WAVE_STROKE = 2 / 3

/** Whether a dotted line has room for a dot, which `drawDots` paints one line height apart. */
function hasDots(rect: TextDecorationRect): boolean {
  return rect.height > 0 && rect.width >= rect.height
}

/**
 * Where a decoration draws ink: its rect, which a dotted line's dots and a straight line fill,
 * and a wavy line's stroke reaching past its crests and troughs; `null` for a dotted line too
 * short for a dot.
 */
export function decorationInk(rect: TextDecorationRect): VisualBounds | null {
  if (rect.style === 'DOTTED' && !hasDots(rect)) return null
  const reach = rect.style === 'WAVY' ? (rect.height * WAVE_STROKE) / 2 : 0
  return {
    minX: rect.x - reach,
    minY: rect.y - reach,
    maxX: rect.x + rect.width + reach,
    maxY: rect.y + rect.height + reach
  }
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
  paint.setStrokeWidth(rect.height * WAVE_STROKE)
  canvas.drawPath(wave, paint)
  wave.delete()
}

/** Draws one decoration in `paint`, or in `colour` in its place; `paint` is left as it was. */
export function drawDecoration(
  ck: CanvasKit,
  canvas: Canvas,
  rect: TextDecorationRect,
  paint: Paint,
  colour?: Color
): void {
  const drawn = paint.copy()
  try {
    drawn.setAntiAlias(true)
    drawn.setStyle(ck.PaintStyle.Fill)
    if (colour) {
      drawn.setShader(null)
      drawn.setColorComponents(colour.r, colour.g, colour.b, colour.a)
    }
    if (rect.style === 'DOTTED') drawDots(ck, canvas, rect, drawn)
    else if (rect.style === 'WAVY') drawWave(ck, canvas, rect, drawn)
    else canvas.drawRect(ck.XYWHRect(rect.x, rect.y, rect.width, rect.height), drawn)
  } finally {
    drawn.delete()
  }
}

/**
 * Draws decorations: those in the layer's fills in each pass's `textPaint`, as the text's glyphs
 * are, and the rest in their own colour, or, with `ownApart`, not at all, as they are drawn once,
 * apart, in all of their paints.
 */
export function drawTextDecorations(
  ck: CanvasKit,
  canvas: Canvas,
  rects: readonly TextDecorationRect[],
  textPaint: Paint,
  space: ColorProfile,
  layerFills: readonly Fill[],
  ownApart = false
): void {
  for (const rect of rects) {
    if (rect.fills === layerFills) {
      drawDecoration(ck, canvas, rect, textPaint)
      continue
    }
    if (ownApart) continue
    const fill = solidColor(rect.fills)
    const colour = fill && toExtendedSRGB(normalizeColor(fill.color), space)
    drawDecoration(ck, canvas, rect, textPaint, colour && { ...colour, a: colour.a * fill.opacity })
  }
}

/**
 * The frames of the text's keycaps, which its layout leaves to be drawn, each in the paint
 * `paintAt` gives its style run, if it gives one.
 */
export function drawKeycapFrames(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  layout: TextLayout,
  y: number,
  paintAt: (run?: StyleRun) => Paint | null
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
  for (const glyph of laidOutGlyphs(node, layout, text, y) ?? []) {
    const character = glyph.firstCharacter
    if (character === undefined || text[character] !== COMBINING_KEYCAP) continue
    const source = sourceIndexAt.get(character) ?? character
    const paint = paintAt(styleRunAt(node.styleRuns, source))
    // On the whole pixel its character is drawn on.
    if (paint) drawKeycapFrame(ck, canvas, glyph.x, drawnBaseline(glyph.y), glyph.fontSize, paint)
  }
}

/** The decorations of laid-out text `y` below the node's top, kept with the prepared text. */
export function textLayoutDecorations(
  node: SceneNode,
  prepared: PreparedText,
  y: number
): readonly TextDecorationRect[] {
  if (prepared.decorations?.y !== y) {
    const glyphs = laidOutGlyphs(node, prepared.paragraph, shownText(node), y)
    const rects = glyphs ? textDecorationRects(node, laidOutDecoratedGlyphs(glyphs)) : []
    prepared.decorations = { y, rects }
  }
  return prepared.decorations.rects
}

/**
 * Draws laid-out text and its decorations, `y` below the node's top. The decorations are kept
 * with the prepared text, which its cache replaces when an input of the text changes. With
 * `ownApart`, what has paints of its own is left to be drawn once, apart from the layer's passes.
 */
export function drawTextLayout(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  prepared: PreparedText,
  y: number,
  textPaint: Paint,
  space: ColorProfile,
  ownApart = false
): void {
  const layout = prepared.paragraph
  layout.draw(canvas, 0, y)
  let runPaint: Paint | undefined
  try {
    // A frame takes the colour the paragraph gives its mark: its style run's, if it has one.
    drawKeycapFrames(ck, canvas, node, layout, y, (run) => {
      if (ownApart && run?.style.fills) return null
      runPaint ??= textPaint.copy()
      runPaint.setColor(
        run ? styleRunColor(ck, run.style, textPaint.getColor(), space) : textPaint.getColor()
      )
      return runPaint
    })
  } finally {
    runPaint?.delete()
  }
  if (!hasDecoration(node)) return
  const rects = textLayoutDecorations(node, prepared, y)
  drawTextDecorations(ck, canvas, rects, textPaint, space, node.fills, ownApart)
}
