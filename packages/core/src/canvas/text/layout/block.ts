import type { LineMetrics, Paragraph } from 'canvaskit-wasm'

import type { TextLayoutBlockLines } from '#core/canvas/text/layout/lines'

/** A list item's number or bullet, laid out on its own. */
export interface TextLayoutMarker {
  paragraph: Paragraph
  kind: 'bullet' | 'number'
  /** Font size of the list's first character, which sets the marker's distance from the text. */
  em: number
  /** The face the marker is set in, for its glyph outlines. */
  face: { family: string; style: string }
  /** Where the marker is drawn and the line of the item it marks, set by layout. */
  x: number
  y: number
  lineNumber: number
}

/** One paragraph of the text, or the whole text when it needs no paragraph layout of its own. */
export interface TextLayoutBlock {
  paragraph: Paragraph
  /** Rebuilds the paragraph to show at most `maxLines` lines, when the text is truncated. */
  rebuild?: (maxLines: number) => Paragraph
  /** The first character the block holds, as an index into the text and in UTF-8 bytes. */
  start: number
  utf8Start: number
  /** Characters the block holds, not counting the newline that ends it. */
  length: number
  /** Indices before the text, in UTF-16 and UTF-8, and its width: a first-line indent. */
  lead: number
  utf8Lead: number
  leadWidth: number
  /** Laid out from a space, standing for a paragraph with no characters. */
  empty: boolean
  /** Distance of the text from the start edge: a list item's indent. */
  inset: number
  rtl: boolean
  /** Space above the block, from the paragraph before it. */
  spaceBefore: number
  marker: TextLayoutMarker | null
  /** What placing its lines as Figma does needs; without it they stack as the paragraph's. */
  lines?: TextLayoutBlockLines
  x: number
  y: number
  /** Whether the block is shown, as truncation hides blocks past its last line. */
  visible: boolean
  /** The paragraph's line metrics, read once when the block is laid out. */
  metrics: LineMetrics[]
}

export function paragraphBlock(
  paragraph: Paragraph,
  length: number,
  lines?: TextLayoutBlockLines
): TextLayoutBlock {
  return {
    paragraph,
    start: 0,
    utf8Start: 0,
    length,
    lead: 0,
    utf8Lead: 0,
    leadWidth: 0,
    empty: false,
    inset: 0,
    rtl: false,
    spaceBefore: 0,
    marker: null,
    lines,
    x: 0,
    y: 0,
    visible: true,
    metrics: []
  }
}

export function toTextIndex(block: TextLayoutBlock, index: number): number {
  return block.start + Math.max(0, Math.min(block.length, index - block.lead))
}

export function toUtf8(block: TextLayoutBlock, offset: number): number {
  return block.empty ? block.utf8Start : block.utf8Start + Math.max(0, offset - block.utf8Lead)
}
