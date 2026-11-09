import type {
  Canvas,
  CanvasKit,
  LineMetrics,
  Paragraph,
  PositionWithAffinity,
  RectHeightStyle,
  RectWidthStyle,
  RectWithDirection,
  ShapedLine
} from '@open-pencil/canvaskit'

import { lineBands, lineBoxBands } from '#core/canvas/text/layout/apart'
import {
  blockLineNumber,
  paragraphBlock,
  type TextLayoutBlock,
  type TextLayoutMarker
} from '#core/canvas/text/layout/block'
import { TextDrawing, type LinesApart } from '#core/canvas/text/layout/drawing'
import {
  fitLines,
  holdsGlyphs,
  trailingSpacing,
  UNSPACED_LINES,
  type BlockAllowances,
  type BlockWidth,
  type FittedBlock,
  type FittedLines,
  type LineFitting
} from '#core/canvas/text/layout/fit'
import {
  allSame,
  buildPieces,
  placeLines,
  shapedLinesByLine,
  type BlockPlacement
} from '#core/canvas/text/layout/lines'
import { blockOrigin, placeMarker } from '#core/canvas/text/layout/marker'
import { collectTextLines } from '#core/canvas/text/layout/metrics'
import {
  caretRect,
  glyphPositionAt,
  rangeRects,
  type LineShift,
  type PlacedBlocks,
  type TextCaretBox
} from '#core/canvas/text/layout/positions'
import { textShapedLines } from '#core/canvas/text/layout/shaped'
import {
  alignFirstBaseline,
  FirstLineCapHeights,
  trimToCapHeight,
  type LineCapHeight
} from '#core/canvas/text/layout/vertical'

interface ShiftsApart {
  shifts: number[]
  drawn: boolean
  drawing?: LinesApart
}

interface SettledAllowance {
  boxWidth: number
  allowances: BlockAllowances
}

/** Box widths whose settled allowance a layout keeps, as auto width alternates two. */
const SETTLED_WIDTHS = 4

/**
 * A laid-out text node: one native paragraph per block, stacked with paragraph and list
 * spacing, each indented by its list level and preceded by its marker. It answers the
 * `Paragraph` queries the renderer, measurement, and the text editor ask, in indices of the
 * whole text and coordinates of the whole layout.
 */
export class TextLayout {
  private lines: LineMetrics[] = []
  private lineOffsets: number[] = []
  private truncated = false
  private readonly placements = new Map<TextLayoutBlock, BlockPlacement>()
  private readonly drawing: TextDrawing
  private readonly apart = new Map<TextLayoutBlock, ShiftsApart>()
  private visible: readonly TextLayoutBlock[]
  private fits: readonly FittedBlock[] = []
  private settled: SettledAllowance[] = []
  private laidOutWidth: BlockWidth = () => 0
  /** The text's height when layout placed its lines itself. */
  private placedHeight: number | null = null

  /** Text laid out as one native paragraph of `length` characters, not yet laid out. */
  static ofParagraph(ck: CanvasKit, paragraph: Paragraph, length: number): TextLayout {
    return new TextLayout(ck, [paragraphBlock(length, { paragraph })])
  }

  constructor(
    private readonly ck: CanvasKit,
    readonly blocks: TextLayoutBlock[],
    /** Lines the text may show in all, when it is truncated across blocks. */
    private readonly maxLines?: number,
    capHeight?: LineCapHeight,
    private readonly fitting: LineFitting = UNSPACED_LINES
  ) {
    this.capHeights = capHeight && new FirstLineCapHeights(capHeight)
    this.drawing = new TextDrawing(ck)
    this.visible = blocks
  }

  /** The line cap a block's paragraph was rebuilt with, when it differs from `maxLines`. */
  private readonly caps = new Map<TextLayoutBlock, number>()
  private readonly capHeights: FirstLineCapHeights | undefined

  private visibleBlocks(): readonly TextLayoutBlock[] {
    return this.visible
  }

  layout(boxWidth: number): void {
    let fitted = this.fit(boxWidth)
    if (this.joinLinesApart(fitted)) {
      fitted = this.fit(boxWidth)
    }
    this.settle(boxWidth, fitted.allowances)
    this.laidOutWidth = fitted.width
    this.fits = fitted.fits
    for (const [order, fit] of fitted.fits.entries()) {
      this.shiftLines(fitted.visible[order], fit)
    }
    this.placeLines(fitted.width)
    this.alignFirstBaseline()
    this.trimToCapHeight()
    for (const [order, block] of fitted.visible.entries()) {
      if (block.marker) {
        const firstLineStart = block.metrics.at(0)?.left ?? 0
        placeMarker(block, fitted.fits.at(order)?.markerLineStart ?? firstLineStart)
      }
    }
    this.collectLines()
    this.height = this.measureHeight()
  }

  private readonly layoutVisible = (width: BlockWidth): readonly TextLayoutBlock[] => {
    this.layoutBlocks(width)
    return this.visible
  }

  private fit(boxWidth: number): FittedLines {
    return fitLines(this.ck, this.fitting, boxWidth, this.layoutVisible, {
      settled: this.settled.find((entry) => entry.boxWidth === boxWidth)?.allowances,
      joined: this.blocks.some((block) => block.joiners.count > 0)
    })
  }

  private joinLinesApart(fitted: FittedLines): boolean {
    let joined = false
    for (const [order, fit] of fitted.fits.entries()) {
      const block = fitted.visible[order]
      if (block.join && fit.inkedApart) {
        this.join(block, block.join)
        joined = true
      }
    }
    if (joined) {
      this.settled = []
    }
    return joined
  }

  private join(block: TextLayoutBlock, join: NonNullable<TextLayoutBlock['join']>): void {
    const joinedBlock = join(this.caps.get(block) ?? this.maxLines)
    block.paragraph.delete()
    if ('blocks' in joinedBlock) {
      this.blocks.splice(this.blocks.indexOf(block), 1, ...joinedBlock.blocks)
      return
    }
    Object.assign(block, joinedBlock)
    block.join = undefined
    block.tailShifts.clear()
  }

  private settle(boxWidth: number, allowances: BlockAllowances): void {
    const known = this.settled.find((entry) => entry.boxWidth === boxWidth)
    if (known) {
      known.allowances = allowances
      return
    }
    if (this.settled.length >= SETTLED_WIDTHS) {
      this.settled.shift()
    }
    this.settled.push({ boxWidth, allowances })
  }

  private shiftLines(block: TextLayoutBlock, fit: FittedBlock): void {
    block.x += fit.blockShift
    if (fit.lineShifts.length < 2) {
      return
    }
    const apart = fit.lineShifts.map((shift) => shift - fit.blockShift)
    if (allSame(apart)) {
      return
    }
    this.apart.set(block, { shifts: apart, drawn: fit.inkedApart })
  }

  private readonly lineShift: LineShift = (block, index) =>
    this.apart.get(block)?.shifts[index] ?? 0

  private readonly blockLineShifts = (block: TextLayoutBlock): readonly number[] =>
    this.apart.get(block)?.shifts ?? block.metrics.map(() => 0)

  private layoutBlocks(width: BlockWidth): void {
    let y = 0
    let lines = 0
    this.truncated = false
    this.clearPlacements()
    const visible: TextLayoutBlock[] = []
    for (const [index, block] of this.blocks.entries()) {
      const remaining = this.maxLines === undefined ? Infinity : this.maxLines - lines
      block.visible = remaining > 0
      if (!block.visible) {
        this.truncated = true
        continue
      }
      block.paragraph.layout(Math.max(1, width(block) - block.inset))
      block.metrics = block.paragraph.getLineMetrics()
      // A block capped for a narrower layout gets its lines back when there is room for them.
      const cap = this.caps.get(block) ?? this.maxLines ?? Infinity
      const overflows = block.metrics.length > remaining
      const clipped = cap < remaining && block.paragraph.didExceedMaxLines()
      if ((overflows || clipped) && block.rebuild) {
        block.paragraph.delete()
        block.paragraph = block.rebuild(remaining)
        block.tailShifts.clear()
        this.caps.set(block, remaining)
        this.capHeights?.clear()
        block.paragraph.layout(Math.max(1, width(block) - block.inset))
        block.metrics = block.paragraph.getLineMetrics()
      }
      if (block.paragraph.didExceedMaxLines()) this.truncated = true
      if (index > 0) y += block.spaceBefore
      block.x = blockOrigin(block)
      block.y = y
      y += block.paragraph.getHeight()
      lines += block.metrics.length
      visible.push(block)
    }
    this.visible = visible
  }

  /** The laid-out height, kept from the layout so a draw asks the paragraphs nothing. */
  private height: number | null = null

  private measureHeight(): number {
    const last = this.visibleBlocks().at(-1)
    if (this.placedHeight !== null) return this.placedHeight
    return last ? last.y + last.paragraph.getHeight() : 0
  }

  private clearPlacements(): void {
    for (const placement of this.placements.values()) {
      for (const piece of placement.pieces ?? []) piece.paragraph.delete()
    }
    for (const { drawing } of this.apart.values()) {
      for (const piece of drawing?.pieces ?? []) {
        piece.paragraph.delete()
      }
    }
    this.placements.clear()
    this.apart.clear()
    this.fits = []
    this.drawing.clear()
    this.placedHeight = null
    this.height = null
  }

  /**
   * Places lines as Figma does when they differ in height, keeping the paragraph's placement
   * otherwise (`placeLines`).
   */
  private placeLines(width: BlockWidth): void {
    const placed = placeLines(this.ck, this.visibleBlocks(), width, this.blockLineShifts)
    if (!placed) return
    for (const [block, { y, ...placement }] of placed.blocks) {
      block.y = y
      this.placements.set(block, placement)
    }
    this.placedHeight = placed.height
  }

  private alignFirstBaseline(): void {
    if (this.placedHeight !== null) return
    const height = alignFirstBaseline(this.ck, this.visibleBlocks(), this.lineOffset, () =>
      this.measureHeight()
    )
    if (height !== null) this.placedHeight = height
  }

  private trimToCapHeight(): void {
    if (!this.capHeights) {
      return
    }
    const height = trimToCapHeight(this.visibleBlocks(), this.lineOffset, this.capHeights)
    if (height !== null) this.placedHeight = height
  }

  /** The block's line `index` stands this far below where its paragraph has it. */
  private readonly lineOffset = (block: TextLayoutBlock, index: number): number =>
    this.placements.get(block)?.offsets[index] ?? 0

  private readonly placementOf = (block: TextLayoutBlock): BlockPlacement | undefined =>
    this.placements.get(block)

  private readonly placed: PlacedBlocks = {
    placementOf: this.placementOf,
    lineShift: this.lineShift
  }

  private linesApartOf(block: TextLayoutBlock): LinesApart | null {
    const placed = this.placements.get(block)
    if (placed?.pieces) {
      return { bands: [], pieces: placed.pieces }
    }
    const apart = this.apart.get(block)
    if (!apart?.drawn) {
      return null
    }
    apart.drawing ??= this.drawApart(block, apart.shifts)
    return apart.drawing
  }

  private drawApart(block: TextLayoutBlock, shifts: readonly number[]): LinesApart {
    const shaped = shapedLinesByLine(block.paragraph)
    const bands = lineBands(this.ck, shifts, shaped)
    if (bands) {
      return { bands, pieces: [] }
    }
    const moves = { x: shifts, y: shifts.map(() => 0) }
    const pieces = buildPieces(block, this.laidOutWidth(block), moves, { shaped })
    return pieces
      ? { bands: [], pieces }
      : { bands: lineBoxBands(shifts, block.metrics), pieces: [] }
  }

  private collectLines(): void {
    const visible = this.visibleBlocks()
    const { lines, blockFirstLines } = collectTextLines(visible, this.placed)
    for (const [order, block] of visible.entries()) {
      if (block.marker) block.marker.lineNumber = blockFirstLines[order]
    }
    this.lines = lines
    this.lineOffsets = blockFirstLines
  }

  getHeight(): number {
    return this.height ?? this.measureHeight()
  }

  getLongestLine(): number {
    let longest = 0
    for (const [order, block] of this.visibleBlocks().entries()) {
      if (block.empty) continue
      const glyphWidth = this.fits.at(order)?.glyphWidth ?? block.paragraph.getLongestLine()
      longest = Math.max(longest, block.inset + glyphWidth)
    }
    // Skia measures in float32: rounding back keeps a whole-pixel line from ceiling a pixel wider.
    return Math.fround(longest)
  }

  getLineGlyphsWidth(lineNumber: number): number {
    const line = this.lines.at(lineNumber)
    if (!line || !holdsGlyphs(line)) {
      return 0
    }
    const order = this.lineOffsets.findLastIndex((first) => first <= lineNumber)
    const block = this.visibleBlocks()[order]
    const blockLine = lineNumber - this.lineOffsets[order]
    const indent = blockLine === 0 ? block.leadWidth : 0
    return block.metrics[blockLine].width - indent - trailingSpacing(this.fitting, block, blockLine)
  }

  didExceedMaxLines(): boolean {
    return this.truncated
  }

  getLineMetrics(): LineMetrics[] {
    return this.lines
  }

  getLineMetricsAt(lineNumber: number): LineMetrics | null {
    return this.lines[lineNumber] ?? null
  }

  /** The block holding text index `index`; the newline ending a block belongs to it. */
  private blockAt(index: number): { block: TextLayoutBlock; order: number } | null {
    const visible = this.visibleBlocks()
    for (const [order, block] of visible.entries()) {
      if (index <= block.start + block.length) return { block, order }
    }
    const last = visible.at(-1)
    return last ? { block: last, order: visible.length - 1 } : null
  }

  getLineNumberAt(index: number): number {
    const found = this.blockAt(index)
    if (!found) return -1
    const { block, order } = found
    const local = block.empty ? 0 : blockLineNumber(block, index)
    const isLast = order === this.lineOffsets.length - 1
    if (local < 0) {
      if (isLast) return local
      return this.lineOffsets[order] + block.paragraph.getLineMetrics().length - 1
    }
    return this.lineOffsets[order] + local
  }

  getGlyphPositionAtCoordinate(x: number, y: number): PositionWithAffinity {
    return glyphPositionAt(this.ck, this.visibleBlocks(), this.placed, x, y)
  }

  getRectsForRange(
    start: number,
    end: number,
    heightStyle: RectHeightStyle,
    widthStyle: RectWidthStyle
  ): RectWithDirection[] {
    return rangeRects(
      this.ck,
      this.visibleBlocks(),
      this.placed,
      start,
      end,
      heightStyle,
      widthStyle
    )
  }

  getCaretRect(index: number, rtl: boolean): TextCaretBox | null {
    const found = this.blockAt(index)
    if (!found) return null
    return caretRect(this.ck, found.block, this.placed, index, rtl)
  }

  getShapedLines(): ShapedLine[] {
    return textShapedLines(this.ck, this.visibleBlocks(), this.lineOffset, this.lineShift)
  }

  /** Markers of the visible list items, where layout placed them. */
  getMarkers(): TextLayoutMarker[] {
    const markers: TextLayoutMarker[] = []
    for (const block of this.visibleBlocks()) if (block.marker) markers.push(block.marker)
    return markers
  }

  /** Draws the text with every baseline on a whole pixel of its box, as Figma does. */
  draw(canvas: Canvas, x: number, y: number): void {
    this.drawing.draw(canvas, x, y, this.visibleBlocks(), this.lineOffset, (block) =>
      this.linesApartOf(block)
    )
  }

  isDeleted(): boolean {
    return this.blocks.every((block) => block.paragraph.isDeleted())
  }

  delete(): void {
    this.clearPlacements()
    for (const block of this.blocks) {
      block.paragraph.delete()
      block.marker?.paragraph.delete()
    }
  }
}
