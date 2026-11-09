import type { CanvasKit, LineMetrics, Paragraph } from '@open-pencil/canvaskit'

import type { TextLayoutBlockLines } from '#core/canvas/text/layout/lines'
import { JoinerIndex, type Joiner } from '#core/canvas/text/paragraph/joiners'

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
  joiners: JoinerIndex
  join?: (maxLines: number | undefined) => JoinedBlock | SplitBlock
  tailShifts: Map<Joiner, number>
  /** Laid out from a space, standing for a paragraph with no characters. */
  empty: boolean
  /** Whether the text's newline after the block starts the next group of a long joined text. */
  endsAtSeam: boolean
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

export type JoinedBlock = Pick<TextLayoutBlock, 'paragraph' | 'rebuild' | 'joiners' | 'lines'>

export interface SplitBlock {
  blocks: TextLayoutBlock[]
}

export type BlockBuild = JoinedBlock & Pick<TextLayoutBlock, 'join'>

export function paragraphBlock(
  length: number,
  {
    paragraph,
    lines,
    joiners = JoinerIndex.EMPTY,
    join
  }: Partial<BlockBuild> & Pick<BlockBuild, 'paragraph'>
): TextLayoutBlock {
  return {
    paragraph,
    start: 0,
    utf8Start: 0,
    length,
    lead: 0,
    utf8Lead: 0,
    leadWidth: 0,
    joiners,
    join,
    tailShifts: new Map(),
    empty: false,
    endsAtSeam: false,
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
  const offset = block.joiners.textOffset(index - block.lead)
  return block.start + Math.max(0, Math.min(block.length, offset))
}

export function toParagraphIndex(block: TextLayoutBlock, index: number): number {
  return block.lead + block.joiners.paragraphOffset(index - block.start)
}

export function toCharacterIndex(block: TextLayoutBlock, index: number): number {
  return block.lead + block.joiners.characterOffset(index - block.start)
}

// A right-to-left glyph's box does not end at the joiner after it.
export function joinerGlyphEnd(
  ck: CanvasKit,
  block: TextLayoutBlock,
  joiner: Joiner
): number | undefined {
  const glyph = block.paragraph.getGlyphInfoAt(toParagraphIndex(block, block.start + joiner.at) - 1)
  return glyph?.dir === ck.TextDirection.LTR ? glyph.graphemeLayoutBounds[2] : undefined
}

// Skia shapes a joiner in a font other than its glyph's in a run of its own, a second spacing back.
export function joinerTailShift(ck: CanvasKit, block: TextLayoutBlock, joiner: Joiner): number {
  const known = block.tailShifts.get(joiner)
  if (known !== undefined) {
    return known
  }
  const glyphEnd = joinerGlyphEnd(ck, block, joiner)
  const at = toParagraphIndex(block, block.start + joiner.at)
  const tailStart = block.paragraph.getGlyphInfoAt(at + 1)?.graphemeLayoutBounds[0]
  const measured = glyphEnd !== undefined && tailStart !== undefined
  const shift = measured ? glyphEnd - tailStart : joiner.spacing
  block.tailShifts.set(joiner, shift)
  return shift
}

export function tailShift(ck: CanvasKit, block: TextLayoutBlock, index: number): number {
  const tail = block.joiners.tailAt(index - block.start)
  return tail ? joinerTailShift(ck, block, tail) : 0
}

export function paragraphLength(
  block: Pick<TextLayoutBlock, 'lead' | 'length' | 'joiners'>
): number {
  return block.lead + block.length + block.joiners.count
}

// Skia's getLineNumberAt reads a UTF-8 index; line metrics count UTF-16 units, as text indices do.
export function blockLineNumber(block: TextLayoutBlock, index: number): number {
  const at = toCharacterIndex(block, index)
  const lines = block.metrics
  if (at >= paragraphLength(block) || at >= (lines.at(-1)?.endIncludingNewline ?? 0)) {
    return -1
  }
  let low = 0
  let high = lines.length - 1
  while (low < high) {
    const middle = (low + high) >>> 1
    if (at < lines[middle].endIncludingNewline) {
      high = middle
    } else {
      low = middle + 1
    }
  }
  return low
}

export function isJoinerIndex(block: TextLayoutBlock, index: number): boolean {
  return block.joiners.joinerAt(index - block.lead) !== undefined
}

export function lineEndJoiner(block: TextLayoutBlock, line: LineMetrics): Joiner | undefined {
  return block.joiners.joinerAt(line.endExcludingWhitespaces - 1 - block.lead)
}

export function spacedLineWidth(block: TextLayoutBlock, line: LineMetrics): number {
  return line.width + (lineEndJoiner(block, line)?.spacing ?? 0)
}

export function utf8JoinerAt(block: TextLayoutBlock, offset: number): Joiner | undefined {
  return block.joiners.joinerAt(offset - block.utf8Lead, 'utf8')
}

export function toUtf8(block: TextLayoutBlock, offset: number): number {
  if (block.empty) {
    return block.utf8Start
  }
  const inText = block.joiners.textOffset(offset - block.utf8Lead, 'utf8')
  return block.utf8Start + Math.max(0, inText)
}
