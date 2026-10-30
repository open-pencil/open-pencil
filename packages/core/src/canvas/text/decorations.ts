import type { Canvas, CanvasKit, Paint } from 'canvaskit-wasm'
import { isEqual } from 'es-toolkit/predicate'

import type {
  DerivedTextGlyph,
  Fill,
  SceneNode,
  TextDecorationStyle
} from '@open-pencil/scene-graph'
import { resolveRGBAForPreview } from '@open-pencil/scene-graph/color'
import { faceLoadKey } from '@open-pencil/scene-graph/font-style'

import { outlineInk, savedGlyphInk, type InkSpan } from '#core/canvas/text/ink'
import { COMBINING_KEYCAP, drawKeycapFrame } from '#core/canvas/text/keycap'
import type { TextLayout } from '#core/canvas/text/layout'
import { styleRunColor } from '#core/canvas/text/paragraph'
import { laidOutGlyphs, type LaidOutGlyph } from '#core/canvas/text/placed'
import type { PreparedText } from '#core/canvas/text/preparation/cache'
import { shownCharacters, shownText } from '#core/text/case'
import { characterStyles, TEXT_STYLE_KEYS, type CharacterStyle } from '#core/text/character-style'
import { fontDecorationMetricsSync, type FontDecorationMetrics } from '#core/text/font/glyphs'

/**
 * Figma's Inter, measured from the decorations it saves, for text drawn without its font: its
 * glyphs come from the file, but the font's own metrics are not at hand.
 */
const UNLOADED_FONT_METRICS: FontDecorationMetrics = {
  underlineTop: 0.19887,
  underlineThickness: 0.06818,
  strikethroughTop: -0.32742,
  strikethroughThickness: 0.06818
}

/** A glyph where it stands, as saved and freshly laid-out glyphs both give it. */
export type PlacedGlyph = Pick<
  DerivedTextGlyph,
  'x' | 'y' | 'firstCharacter' | 'advance' | 'scaleX'
>

/** A placed glyph that can tell where its ink crosses a band, when its outline is known. */
export interface DecoratedGlyph extends PlacedGlyph {
  ink?: (top: number, bottom: number) => InkSpan | null
}

/** Decorated characters on one line: its baseline, their extent, and the glyphs drawing them. */
interface LineSpan {
  baseline: number
  x1: number
  x2: number
  glyphs: { glyph: DecoratedGlyph; advance: number }[]
}

/** One underline or strikethrough on one line, as Figma saves it. */
export interface TextDecorationRect {
  /** The first character it decorates, by whose style Figma saves it. */
  firstCharacter: number
  x: number
  y: number
  width: number
  height: number
  style: TextDecorationStyle
  /** The decoration's own paints, or the text's when it has none. */
  fills: Fill[]
}

/** Whether any character of the text is underlined or struck through. */
export function hasDecoration(node: SceneNode): boolean {
  return (
    node.textDecoration !== 'NONE' ||
    node.styleRuns.some((run) => run.style.textDecoration && run.style.textDecoration !== 'NONE')
  )
}

/** Whether two characters' decorations are one line: Figma joins characters of one style. */
function sameDecoration(a: CharacterStyle, b: CharacterStyle): boolean {
  return (
    a.textDecoration === b.textDecoration &&
    a.textDecorationStyle === b.textDecorationStyle &&
    a.textDecorationThickness === b.textDecorationThickness &&
    a.textUnderlineOffset === b.textUnderlineOffset &&
    a.fontFamily === b.fontFamily &&
    a.fontWeight === b.fontWeight &&
    a.italic === b.italic &&
    a.fontSize === b.fontSize &&
    isEqual(a.textDecorationFills, b.textDecorationFills) &&
    isEqual(a.fills, b.fills)
  )
}

/** A glyph's advance; one saved without it reaches the next glyph on its line. */
function glyphAdvance(glyph: PlacedGlyph, next: PlacedGlyph | undefined): number {
  if (glyph.advance !== undefined) return glyph.advance * (glyph.scaleX ?? 1)
  return next?.y === glyph.y ? next.x - glyph.x : 0
}

/** Where the glyphs drawing `text[start, end)` sit, one span per line. */
function lineSpans(
  glyphs: readonly DecoratedGlyph[],
  byCharacter: ReadonlyMap<number, number[]>,
  start: number,
  end: number
): LineSpan[] {
  const lines = new Map<number, LineSpan>()
  for (let character = start; character < end; character++) {
    for (const index of byCharacter.get(character) ?? []) {
      const glyph = glyphs[index]
      const advance = glyphAdvance(glyph, glyphs.at(index + 1))
      const line = lines.get(glyph.y)
      if (line) {
        line.x1 = Math.min(line.x1, glyph.x)
        line.x2 = Math.max(line.x2, glyph.x + advance)
        line.glyphs.push({ glyph, advance })
      } else {
        lines.set(glyph.y, {
          baseline: glyph.y,
          x1: glyph.x,
          x2: glyph.x + advance,
          glyphs: [{ glyph, advance }]
        })
      }
    }
  }
  return [...lines.values()]
}

/**
 * Where an underline breaks for descenders, as Figma skips ink: around each glyph's ink in the
 * band the underline covers before its baseline is rounded, kept within the glyph's own box and
 * widened by `pad` on each side.
 */
function inkGaps(line: LineSpan, top: number, height: number, pad: number): InkSpan[] {
  const bandTop = line.baseline + top
  const gaps: InkSpan[] = []
  for (const { glyph, advance } of line.glyphs) {
    const ink = glyph.ink?.(bandTop, bandTop + height)
    if (!ink) continue
    const left = Math.max(ink[0], glyph.x)
    const right = Math.min(ink[1], glyph.x + advance)
    if (right >= left) gaps.push([left - pad, right + pad])
  }
  return gaps.toSorted((a, b) => a[0] - b[0])
}

/** The parts of `[x1, x2]` outside every gap, but for pieces narrower than `minWidth`. */
function withoutGaps(
  x1: number,
  x2: number,
  gaps: readonly InkSpan[],
  minWidth: number
): InkSpan[] {
  const parts: InkSpan[] = []
  let from = x1
  for (const [left, right] of gaps) {
    if (left > from) parts.push([from, Math.min(left, x2)])
    from = Math.max(from, right)
    if (from >= x2) break
  }
  if (from < x2) parts.push([from, x2])
  if (gaps.length === 0) return parts
  return parts.filter(([left, right]) => right - left >= minWidth)
}

function decorationRects(
  style: CharacterStyle,
  firstCharacter: number,
  lines: LineSpan[]
): TextDecorationRect[] {
  const metrics =
    fontDecorationMetricsSync(style.fontFamily, faceLoadKey(style.fontWeight, style.italic)) ??
    UNLOADED_FONT_METRICS
  const size = style.fontSize
  const underline = style.textDecoration === 'UNDERLINE'
  // Figma measures from the baseline rounded to a whole pixel. An underline's offset and
  // thickness replace the font's; a strikethrough always takes the font's, and is solid.
  const top = underline
    ? (style.textUnderlineOffset ?? metrics.underlineTop * size)
    : metrics.strikethroughTop * size
  const height = underline
    ? (style.textDecorationThickness ?? metrics.underlineThickness * size)
    : metrics.strikethroughThickness * size
  const fills = style.textDecorationFills.length > 0 ? style.textDecorationFills : style.fills
  const skipInk = underline && style.textDecorationSkipInk
  // Figma widens a solid underline's gaps by its thickness and drops the slivers they leave; a
  // dotted or wavy one's by 0.6 of it, keeping every piece (measured from 12px to 88px).
  const solid = !underline || style.textDecorationStyle === 'SOLID'
  const pad = solid ? height : height * 0.6
  const minWidth = solid ? height : 0
  return lines.flatMap((line) => {
    const gaps = skipInk ? inkGaps(line, top, height, pad) : []
    const parts = withoutGaps(line.x1, line.x2, gaps, minWidth)
    return parts.map(([x1, x2]) => ({
      firstCharacter,
      x: x1,
      y: Math.round(line.baseline) + top,
      width: x2 - x1,
      height,
      style: underline ? style.textDecorationStyle : 'SOLID',
      fills
    }))
  })
}

/**
 * The underlines and strikethroughs of a text over its glyphs, placed as Figma places them:
 * one per line for each run of characters decorated alike, from the font's metrics, with
 * underlines broken where descenders cross them.
 */
export function textDecorationRects(
  node: SceneNode,
  glyphs: readonly DecoratedGlyph[]
): TextDecorationRect[] {
  if (!hasDecoration(node)) return []
  const text = node.text
  const styles = characterStyles(node, 0, text.length)
  const byCharacter = new Map<number, number[]>()
  for (const [index, glyph] of glyphs.entries()) {
    if (glyph.firstCharacter === undefined) continue
    const indices = byCharacter.get(glyph.firstCharacter)
    if (indices) indices.push(index)
    else byCharacter.set(glyph.firstCharacter, [index])
  }
  const rects: TextDecorationRect[] = []
  let start = 0
  while (start < text.length) {
    const style = styles[start]
    if (style.textDecoration === 'NONE' || text[start] === '\n') {
      start++
      continue
    }
    let end = start + 1
    while (end < text.length && text[end] !== '\n' && sameDecoration(styles[end], style)) end++
    rects.push(...decorationRects(style, start, lineSpans(glyphs, byCharacter, start, end)))
    start = end
  }
  return rects
}

/** Saved glyphs, whose ink comes from their saved outlines. */
export function savedDecoratedGlyphs(glyphs: readonly DerivedTextGlyph[]): DecoratedGlyph[] {
  return glyphs.map((glyph) => ({
    ...glyph,
    ink: (top, bottom) => savedGlyphInk(glyph.commandsBlob, glyph, top, bottom)
  }))
}

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

function drawDots(canvas: Canvas, rect: TextDecorationRect, paint: Paint) {
  const radius = rect.height / 2
  const y = rect.y + radius
  for (let x = rect.x + radius; x <= rect.x + rect.width - radius; x += rect.height * 2) {
    canvas.drawCircle(x, y, radius, paint)
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
        paint.setColor(ck.Color4f(red, g, b, a * fill.opacity))
      }
      if (rect.style === 'DOTTED') drawDots(canvas, rect, paint)
      else if (rect.style === 'WAVY') drawWave(ck, canvas, rect, paint)
      else canvas.drawRect(ck.XYWHRect(rect.x, rect.y, rect.width, rect.height), paint)
    } finally {
      paint.delete()
    }
  }
}

/** Decorations of saved glyphs, by the glyphs, with what they were found from. */
export type SavedDecorationCache = WeakMap<
  readonly DerivedTextGlyph[],
  { inputs: unknown[]; rects: TextDecorationRect[] }
>

/**
 * The decorations of text drawn from its saved glyphs. A change that moves or reshapes glyphs
 * replaces them, so only the character styles, and the fonts whose metrics place lines, can
 * change the decorations of the same glyphs.
 */
export function savedTextDecorationRects(
  cache: SavedDecorationCache,
  node: SceneNode,
  glyphs: readonly DerivedTextGlyph[],
  fontGeneration: number
): TextDecorationRect[] {
  const inputs = [
    node.text,
    node.styleRuns,
    fontGeneration,
    ...TEXT_STYLE_KEYS.map((key) => node[key])
  ]
  const cached = cache.get(glyphs)
  if (cached?.inputs.every((value, index) => value === inputs[index])) return cached.rects
  const rects = textDecorationRects(node, savedDecoratedGlyphs(glyphs))
  cache.set(glyphs, { inputs, rects })
  return rects
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
