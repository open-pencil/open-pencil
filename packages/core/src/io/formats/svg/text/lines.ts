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

/** The lines of a text node from the host's text layout, or null to keep the text on one line. */
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

/** One unpositioned span per style run, including uncovered text in the node's own style. */
export function textStyleSpans(node: SceneNode, spanAttrs: SpanAttrs): SVGNode[] {
  return textPieces(node).map((piece) =>
    svg(
      'tspan',
      piece.style ? spanAttrs(piece.style) : {},
      shownTextSlice(node, piece.from, piece.to)
    )
  )
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
  // The newline that ends a line is not drawn.
  const end = node.text[line.end - 1] === '\n' ? line.end - 1 : line.end
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
