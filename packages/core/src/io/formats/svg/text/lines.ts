import type { CharacterStyleOverride, SceneNode } from '@open-pencil/scene-graph'

import { svg, type SVGNode } from '#core/io/formats/svg/node'
import { round } from '#core/io/formats/svg/paths'
import { shownTextSlice } from '#core/text/case'

/**
 * One line of a text node as the editor laid it out: the characters of `node.text` it holds
 * (`end` is exclusive and may include the newline that ends the line) and where its baseline
 * starts, in the node's own coordinates.
 */
export interface SVGTextLine {
  start: number
  end: number
  x: number
  y: number
  width: number
  /**
   * Where the characters are drawn, by index in `node.text`: the left and right edges of their
   * glyphs in the node. With them every span is placed where the editor draws it, instead of
   * after the span before it, which a renderer measures in fonts of its own.
   */
  characters?: ReadonlyMap<number, SVGCharacterEdges>
}

export interface SVGCharacterEdges {
  left: number
  right: number
}

/**
 * Measured lines of a text node, or null when this node has none. Export then keeps only the
 * text's explicit newlines, each on its own baseline.
 */
export type SVGTextLayout = (node: SceneNode) => readonly SVGTextLine[] | null

type SpanAttrs = (style: CharacterStyleOverride) => Record<string, string | number | undefined>

interface TextPiece {
  from: number
  to: number
  style: CharacterStyleOverride | null
}

/** The text cut at its style runs; characters no run covers keep the node's own style. */
function textPieces(node: SceneNode): TextPiece[] {
  const pieces: TextPiece[] = []
  let cursor = 0
  for (const run of node.styleRuns.toSorted((a, b) => a.start - b.start)) {
    if (run.start > cursor) pieces.push({ from: cursor, to: run.start, style: null })
    const from = Math.max(cursor, run.start)
    const to = Math.min(run.start + run.length, node.text.length)
    if (to > from) pieces.push({ from, to, style: run.style })
    cursor = Math.max(cursor, to)
  }
  if (cursor < node.text.length) pieces.push({ from: cursor, to: node.text.length, style: null })
  return pieces
}

/** The left and right edges of the characters from `from` to `to` that have glyphs. */
function spanEdges(line: SVGTextLine, from: number, to: number): SVGCharacterEdges | null {
  let left = Infinity
  let right = -Infinity
  for (let index = from; index < to; index++) {
    const edges = line.characters?.get(index)
    if (!edges) continue
    left = Math.min(left, edges.left)
    right = Math.max(right, edges.right)
  }
  return left <= right ? { left, right } : null
}

function lineSpans(
  node: SceneNode,
  pieces: readonly TextPiece[],
  line: SVGTextLine,
  spanAttrs: SpanAttrs
): SVGNode[] {
  // The newline that ends a line is not drawn. A CR is dropped only with that LF, so a
  // literal trailing CR stays.
  let end = line.end
  if (end > line.start && node.text[end - 1] === '\n') {
    end -= 1
    if (end > line.start && node.text[end - 1] === '\r') end -= 1
  }
  const y = round(line.y)
  const spans: SVGNode[] = []
  for (const piece of pieces) {
    const from = Math.max(piece.from, line.start)
    const to = Math.min(piece.to, end)
    if (to <= from) continue
    const attrs = piece.style ? spanAttrs(piece.style) : {}
    // Every span starts at its left edge, in either direction, since renderers disagree on
    // which side `text-anchor` and `direction` place. Without character edges the first span of
    // a line starts at the line's left edge, and the rest follow on from it.
    const left = spanEdges(line, from, to)?.left ?? (spans.length === 0 ? line.x : null)
    const position = left === null ? {} : { x: round(left), y }
    spans.push(svg('tspan', { ...position, ...attrs }, shownTextSlice(node, from, to)))
  }
  return spans
}

/**
 * Baseline-to-baseline distance with no measured layout. A line height is pixels — a percent is
 * already that fraction of the font size — and automatic (`null` or `0`) is 1.2 times the font
 * size, the estimate text layout uses when it has no font metrics.
 */
function resolvedLineHeight(fontSize: number, lineHeight: number | null): number {
  return lineHeight || fontSize * 1.2
}

/** The line height a run contributes: its own when it sets one, otherwise the node's. */
function runLineHeight(node: SceneNode, style: CharacterStyleOverride | null): number {
  const fontSize = style?.fontSize ?? node.fontSize
  const lineHeight =
    style != null && style.lineHeight !== undefined ? style.lineHeight : node.lineHeight
  return resolvedLineHeight(fontSize, lineHeight)
}

/**
 * The characters that set a line's height. Text excludes the LF that ends the line and the CR
 * of that CRLF, as the canvas does. An empty line is the newline that makes it.
 */
function lineHeightSpan(text: string, start: number, end: number): { from: number; to: number } {
  if (end > start && text[end - 1] === '\n') {
    let contentEnd = end - 1
    if (contentEnd > start && text[contentEnd - 1] === '\r') contentEnd -= 1
    if (contentEnd > start) return { from: start, to: contentEnd }
    return { from: end - 1, to: end }
  }
  if (end > start) return { from: start, to: end }
  // A trailing empty line has no characters of its own; the newline that opened it does.
  return { from: Math.max(0, start - 1), to: start }
}

/**
 * How far this line's baseline stands below the one before it. The line is as tall as the
 * tallest line height on it, and an empty line is as tall as the newline that makes it.
 */
function explicitLineHeight(
  node: SceneNode,
  pieces: readonly TextPiece[],
  start: number,
  end: number
): number {
  const { from, to } = lineHeightSpan(node.text, start, end)
  let height = 0
  let covered = false
  for (const piece of pieces) {
    const pieceFrom = Math.max(piece.from, from)
    const pieceTo = Math.min(piece.to, to)
    if (pieceTo <= pieceFrom) continue
    covered = true
    height = Math.max(height, runLineHeight(node, piece.style))
  }
  return covered ? height : resolvedLineHeight(node.fontSize, node.lineHeight)
}

/**
 * One line per explicit newline, for text exported without a measured layout. `x` is the
 * alignment anchor and `firstBaseline` the first line's baseline, both as the single-line
 * fallback computes them. Each later baseline stands the height of that line below the one
 * before it, as the canvas lays lines out. `null` when the text has no newline, so a single
 * line stays one `<text>`.
 */
export function explicitNewlineLines(
  node: SceneNode,
  x: number,
  firstBaseline: number
): SVGTextLine[] | null {
  if (!node.text.includes('\n')) return null
  const pieces = textPieces(node)
  const parts = node.text.split('\n')
  const lines: SVGTextLine[] = []
  let start = 0
  let y = firstBaseline
  for (const [index, part] of parts.entries()) {
    // The newline that ends a line stays inside the range, as a measured line's `end` does.
    const endsWithBreak = index < parts.length - 1
    const end = start + part.length + (endsWithBreak ? 1 : 0)
    if (index > 0) y += explicitLineHeight(node, pieces, start, end)
    lines.push({ start, end, x, y, width: node.width })
    start = end
  }
  return lines
}

/**
 * One `tspan` per style run on each laid-out line, the first of a line at its own baseline, so a
 * wrapped paragraph keeps the editor's line breaks in renderers that do not wrap SVG text. Each
 * span holds its characters in the case they are shown in.
 */
export function laidOutTextSpans(
  node: SceneNode,
  lines: readonly SVGTextLine[],
  spanAttrs: SpanAttrs
): SVGNode[] {
  const pieces = textPieces(node)
  return lines.flatMap((line) => lineSpans(node, pieces, line, spanAttrs))
}
