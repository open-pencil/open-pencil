import type { CharacterStyleOverride, SceneNode } from '@open-pencil/scene-graph'

import { svg, type SVGNode } from './node'
import { round } from './paths'

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

function lineSpans(
  text: string,
  pieces: readonly TextPiece[],
  line: SVGTextLine,
  rtl: boolean,
  spanAttrs: SpanAttrs
): SVGNode[] {
  // The newline that ends a line is not drawn.
  const end = text[line.end - 1] === '\n' ? line.end - 1 : line.end
  // Right-to-left lines are anchored at their end, so they start from the line's right edge.
  const position = { x: round(rtl ? line.x + line.width : line.x), y: round(line.y) }
  const spans: SVGNode[] = []
  for (const piece of pieces) {
    const from = Math.max(piece.from, line.start)
    const to = Math.min(piece.to, end)
    if (to <= from) continue
    const attrs = piece.style ? spanAttrs(piece.style) : {}
    // The first span of a line places it; the rest follow on from it.
    spans.push(
      svg('tspan', spans.length === 0 ? { ...position, ...attrs } : attrs, text.slice(from, to))
    )
  }
  return spans
}

/**
 * One `tspan` per style run on each laid-out line, the first of a line at its own baseline, so a
 * wrapped paragraph keeps the editor's line breaks in renderers that do not wrap SVG text.
 */
export function laidOutTextSpans(
  node: SceneNode,
  lines: readonly SVGTextLine[],
  rtl: boolean,
  spanAttrs: SpanAttrs
): SVGNode[] {
  const pieces = textPieces(node)
  return lines.flatMap((line) => lineSpans(node.text, pieces, line, rtl, spanAttrs))
}
