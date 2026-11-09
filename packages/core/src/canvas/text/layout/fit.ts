import type { CanvasKit, LineMetrics } from '@open-pencil/canvaskit'

import { isJoinerIndex, toTextIndex, type TextLayoutBlock } from '#core/canvas/text/layout/block'
import {
  isUnspaced,
  NO_LINE_SPACING,
  type LineSpacing
} from '#core/canvas/text/layout/letter-spacing'
import { samePosition } from '#core/canvas/text/layout/lines'
import type { ParagraphTextAlign } from '#core/canvas/text/paragraph'

// Skia hangs a line's last spacing inside it; Figma aligns by glyphs, plus that spacing at a wrap.
export interface LineFitting {
  spacing: LineSpacing
  align: ParagraphTextAlign
  rtl: boolean
  truncatesWithEllipsis: boolean
  keepsCharacterIndices: boolean
}

export const UNSPACED_LINES: LineFitting = {
  spacing: NO_LINE_SPACING,
  align: 'Left',
  rtl: false,
  truncatesWithEllipsis: false,
  keepsCharacterIndices: true
}

interface LineSpan {
  start: number
  end: number
  glyphEnd: number
  hungSpacing: number
  inked: boolean
}

export interface FittedBlock {
  lineShifts: number[]
  blockShift: number
  inkedApart: boolean
  glyphWidth: number
  markerLineStart: number
}

export interface FittedLines {
  width: BlockWidth
  allowances: BlockAllowances
  visible: readonly TextLayoutBlock[]
  fits: readonly FittedBlock[]
}

// Skia itself lets a line run up to 1/128 px past the width it lays the paragraph out at.
const OVERFLOW_TOLERANCE = 0.008
const MAX_LAYOUTS = 4
const BREAK_STEP = 0.01

function startAligned(fitting: LineFitting): boolean {
  return fitting.align === 'Left' || (fitting.align === 'Justify' && !fitting.rtl)
}

function endAligned(fitting: LineFitting): boolean {
  return fitting.align === 'Right' || (fitting.align === 'Justify' && fitting.rtl)
}

function isLastLine(block: TextLayoutBlock, index: number): boolean {
  return index === block.metrics.length - 1
}

function endsInEllipsis(fitting: LineFitting, block: TextLayoutBlock, index: number): boolean {
  return (
    fitting.truncatesWithEllipsis && isLastLine(block, index) && block.paragraph.didExceedMaxLines()
  )
}

// Without right-to-left samples from Figma, those lines keep aligning by their glyphs alone.
function wrapsAtSpace(
  fitting: LineFitting,
  block: TextLayoutBlock,
  line: LineMetrics,
  index: number
): boolean {
  return (
    !fitting.rtl &&
    !isLastLine(block, index) &&
    !line.isHardBreak &&
    line.endExcludingWhitespaces < line.endIndex
  )
}

// Skia counts the ellipsis in the last kept box, not the width; getShapedLines would leak memory.
function ellipsisLineEnd(
  ck: CanvasKit,
  fitting: LineFitting,
  line: LineMetrics,
  block: TextLayoutBlock
): number {
  if (fitting.rtl) {
    return rightToLeftLineEnd(ck, fitting, line, block)
  }
  const last = Math.max(line.startIndex, line.endIndex - 1)
  const lastEnd = boxEnd(block, last) ?? line.left + line.width
  const joined = last > line.startIndex && isJoinerIndex(block, last)
  return joined ? Math.max(lastEnd, boxEnd(block, last - 1) ?? lastEnd) : lastEnd
}

// A joiner in a run of its own ends its box a spacing short; a right-to-left glyph's box ends apart.
function boxEnd(block: TextLayoutBlock, index: number): number | undefined {
  return block.paragraph.getGlyphInfoAt(index)?.graphemeLayoutBounds[2]
}

// Right-to-left text ends at its first glyph, past the spacing after it; the ellipsis is at its left.
function rightToLeftLineEnd(
  ck: CanvasKit,
  fitting: LineFitting,
  line: LineMetrics,
  block: TextLayoutBlock
): number {
  const boxes = block.paragraph.getRectsForRange(
    line.startIndex,
    line.endIndex,
    ck.RectHeightStyle.Tight,
    ck.RectWidthStyle.Tight
  )
  let end = line.left + line.width
  for (const { rect } of boxes) {
    end = Math.max(end, rect[2])
  }
  return end - fitting.spacing.after(toTextIndex(block, line.startIndex))
}

// Skia counts the line break on the empty line after a text's last break as that line's content.
export function holdsGlyphs(line: LineMetrics): boolean {
  return line.endExcludingWhitespaces > line.startIndex && line.width !== 0
}

function lineSpan(
  ck: CanvasKit,
  fitting: LineFitting,
  block: TextLayoutBlock,
  index: number
): LineSpan {
  const line = block.metrics[index]
  const start = line.left
  const end = line.left + line.width
  if (block.empty || !holdsGlyphs(line)) {
    return { start, end, glyphEnd: end, hungSpacing: 0, inked: false }
  }
  if (endsInEllipsis(fitting, block, index)) {
    const glyphEnd = ellipsisLineEnd(ck, fitting, line, block)
    return { start, end: glyphEnd, glyphEnd, hungSpacing: 0, inked: true }
  }
  const trailing = trailingSpacing(fitting, block, index)
  const hungSpacing = wrapsAtSpace(fitting, block, line, index) ? trailing : 0
  return { start, end, glyphEnd: end - trailing, hungSpacing, inked: true }
}

function blockSpans(ck: CanvasKit, fitting: LineFitting, block: TextLayoutBlock): LineSpan[] {
  return block.metrics.map((_, index) => lineSpan(ck, fitting, block, index))
}

function lineShift(fitting: LineFitting, span: LineSpan, available: number): number {
  if (startAligned(fitting)) {
    return -span.start
  }
  const boxEnd = span.glyphEnd + span.hungSpacing
  if (endAligned(fitting)) {
    return available - boxEnd
  }
  return (available - span.start - boxEnd) / 2
}

function glyphWidth(span: LineSpan): number {
  return span.glyphEnd - span.start
}

// Skia stretches a justified line to the layout width, which hides whether its words fit.
function lineAllowanceLimit(
  fitting: LineFitting,
  span: LineSpan,
  available: number,
  allowance: number
): number {
  const laidOutWidth = span.end - span.start
  const stretched =
    fitting.align === 'Justify' && Math.abs(laidOutWidth - available - allowance) < BREAK_STEP
  if (stretched) {
    return allowance - (glyphWidth(span) - available)
  }
  return laidOutWidth - available - BREAK_STEP
}

function blockAllowanceLimit(
  fitting: LineFitting,
  block: TextLayoutBlock,
  spans: readonly LineSpan[],
  boxWidth: number,
  allowance: number
): number {
  const available = boxWidth - block.inset
  let limit = Infinity
  for (const span of spans) {
    if (span.inked && glyphWidth(span) - available > OVERFLOW_TOLERANCE) {
      limit = Math.min(limit, lineAllowanceLimit(fitting, span, available, allowance))
    }
  }
  return limit
}

function nextAllowance(limit: number, allowance: number, floor: number, layouts: number): number {
  if (layouts >= MAX_LAYOUTS - 1) {
    return floor
  }
  const narrowest = allowance > 0 ? 0 : floor
  return Math.max(limit, narrowest)
}

function fittedBlock(
  fitting: LineFitting,
  block: TextLayoutBlock,
  spans: readonly LineSpan[],
  boxWidth: number
): FittedBlock {
  const available = boxWidth - block.inset
  const lineShifts: number[] = []
  let blockShift: number | undefined
  let inkedApart = false
  let widest = 0
  for (const span of spans) {
    const shift = lineShift(fitting, span, available)
    lineShifts.push(shift)
    if (!span.inked) {
      continue
    }
    blockShift ??= shift
    inkedApart ||= !samePosition(blockShift, shift)
    widest = Math.max(widest, glyphWidth(span))
  }
  const firstShift = lineShifts.at(0) ?? 0
  return {
    lineShifts,
    blockShift: blockShift ?? firstShift,
    inkedApart,
    glyphWidth: widest,
    markerLineStart: (spans.at(0)?.start ?? 0) + firstShift
  }
}

function fittedOneLine(
  ck: CanvasKit,
  fitting: LineFitting,
  block: TextLayoutBlock,
  boxWidth: number
): FittedBlock | null {
  if (block.metrics.length !== 1) {
    return null
  }
  const span = lineSpan(ck, fitting, block, 0)
  const available = boxWidth - block.inset
  const overflows = span.inked && glyphWidth(span) - available > OVERFLOW_TOLERANCE
  if (overflows) {
    return null
  }
  const shift = lineShift(fitting, span, available)
  return {
    lineShifts: [shift],
    blockShift: shift,
    inkedApart: false,
    glyphWidth: span.inked ? glyphWidth(span) : 0,
    markerLineStart: span.start + shift
  }
}

export type BlockAllowances = ReadonlyMap<TextLayoutBlock, number>

export type BlockWidth = (block: TextLayoutBlock) => number

export function fitLines(
  ck: CanvasKit,
  fitting: LineFitting,
  boxWidth: number,
  layoutBlocks: (width: BlockWidth) => readonly TextLayoutBlock[],
  { settled, joined }: { settled?: BlockAllowances; joined: boolean }
): FittedLines {
  if (isUnspaced(fitting.spacing)) {
    const width = () => boxWidth
    return { width, allowances: new Map(), visible: layoutBlocks(width), fits: [] }
  }
  const floor = Math.min(fitting.spacing.least, 0)
  const widest = joined ? Math.max(fitting.spacing.most, 0) : fitting.spacing.most
  const allowances = new Map(settled)
  const allowanceOf = (block: TextLayoutBlock) => allowances.get(block) ?? widest
  const width = (block: TextLayoutBlock) => boxWidth + allowanceOf(block)
  for (let layouts = 1; ; layouts++) {
    const visible = layoutBlocks(width)
    for (const block of visible) {
      allowances.set(block, allowanceOf(block))
    }
    const oneLine = visible.length === 1 ? fittedOneLine(ck, fitting, visible[0], boxWidth) : null
    if (oneLine) {
      return { width, allowances, visible, fits: [oneLine] }
    }
    const spans = visible.map((block) => blockSpans(ck, fitting, block))
    let narrowed = false
    for (const [index, block] of visible.entries()) {
      const allowance = allowanceOf(block)
      const limit = blockAllowanceLimit(fitting, block, spans[index], boxWidth, allowance)
      if (limit < allowance && allowance > floor) {
        allowances.set(block, nextAllowance(limit, allowance, floor, layouts))
        narrowed = true
      }
    }
    if (!narrowed) {
      const fits = visible.map((block, index) =>
        fittedBlock(fitting, block, spans[index], boxWidth)
      )
      return { width, allowances, visible, fits }
    }
  }
}

export function trailingSpacing(
  fitting: LineFitting,
  block: TextLayoutBlock,
  index: number
): number {
  const line = block.metrics[index]
  const lastIndex = line.endExcludingWhitespaces - 1
  if (block.empty || !holdsGlyphs(line) || isJoinerIndex(block, lastIndex)) {
    return 0
  }
  return fitting.spacing.after(toTextIndex(block, lastIndex))
}
