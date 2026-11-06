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
} from 'canvaskit-wasm'

import {
  paragraphBlock,
  type TextLayoutBlock,
  type TextLayoutMarker
} from '#core/canvas/text/layout/block'
import { TextDrawing } from '#core/canvas/text/layout/drawing'
import {
  placeLines,
  type BlockPlacement,
  type TextLayoutBlockLines
} from '#core/canvas/text/layout/lines'
import { placeMarker } from '#core/canvas/text/layout/marker'
import { collectTextLines } from '#core/canvas/text/layout/metrics'
import {
  caretRect,
  glyphPositionAt,
  rangeRects,
  type TextCaretBox
} from '#core/canvas/text/layout/positions'
import { textShapedLines } from '#core/canvas/text/layout/shaped'
import {
  alignFirstBaseline,
  FirstLineCapHeights,
  trimToCapHeight,
  type LineCapHeight
} from '#core/canvas/text/layout/vertical'

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
  private readonly drawing = new TextDrawing()
  /** The text's height when layout placed its lines itself. */
  private placedHeight: number | null = null

  /** Text laid out as one native paragraph of `length` characters, not yet laid out. */
  static ofParagraph(
    ck: CanvasKit,
    paragraph: Paragraph,
    length: number,
    lines?: TextLayoutBlockLines,
    capHeight?: LineCapHeight
  ): TextLayout {
    return new TextLayout(ck, [paragraphBlock(paragraph, length, lines)], undefined, capHeight)
  }

  constructor(
    private readonly ck: CanvasKit,
    readonly blocks: TextLayoutBlock[],
    /** Lines the text may show in all, when it is truncated across blocks. */
    private readonly maxLines?: number,
    capHeight?: LineCapHeight
  ) {
    this.capHeights = capHeight && new FirstLineCapHeights(capHeight)
  }

  /** The line cap a block's paragraph was rebuilt with, when it differs from `maxLines`. */
  private readonly caps = new Map<TextLayoutBlock, number>()
  private readonly capHeights: FirstLineCapHeights | undefined

  private visibleBlocks(): TextLayoutBlock[] {
    return this.blocks.filter((block) => block.visible)
  }

  layout(width: number): void {
    this.layoutBlocks(width)
    this.placeLines(width)
    this.alignFirstBaseline()
    this.trimToCapHeight()
    for (const block of this.visibleBlocks()) placeMarker(block)
    this.collectLines()
    this.height = this.measureHeight()
  }

  private layoutBlocks(width: number): void {
    let y = 0
    let lines = 0
    this.truncated = false
    this.clearPlacements()
    for (const [index, block] of this.blocks.entries()) {
      const remaining = this.maxLines === undefined ? Infinity : this.maxLines - lines
      block.visible = remaining > 0
      if (!block.visible) {
        this.truncated = true
        continue
      }
      block.paragraph.layout(Math.max(1, width - block.inset))
      block.metrics = block.paragraph.getLineMetrics()
      // A block capped for a narrower layout gets its lines back when there is room for them.
      const cap = this.caps.get(block) ?? this.maxLines ?? Infinity
      const overflows = block.metrics.length > remaining
      const clipped = cap < remaining && block.paragraph.didExceedMaxLines()
      if ((overflows || clipped) && block.rebuild) {
        block.paragraph.delete()
        block.paragraph = block.rebuild(remaining)
        this.caps.set(block, remaining)
        this.capHeights?.clear()
        block.paragraph.layout(Math.max(1, width - block.inset))
        block.metrics = block.paragraph.getLineMetrics()
      }
      if (block.paragraph.didExceedMaxLines()) this.truncated = true
      if (index > 0) y += block.spaceBefore
      block.x = block.rtl ? 0 : block.inset
      block.y = y
      y += block.paragraph.getHeight()
      lines += block.metrics.length
    }
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
    this.placements.clear()
    this.drawing.clear()
    this.placedHeight = null
    this.height = null
  }

  /**
   * Places lines as Figma does when they differ in height, keeping the paragraph's placement
   * otherwise (`placeLines`).
   */
  private placeLines(width: number): void {
    const placed = placeLines(this.ck, this.visibleBlocks(), width)
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

  private collectLines(): void {
    const visible = this.visibleBlocks()
    const { lines, blockFirstLines } = collectTextLines(visible, this.placementOf)
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
    for (const block of this.visibleBlocks()) {
      if (block.empty) continue
      longest = Math.max(longest, block.inset + block.paragraph.getLongestLine())
    }
    return longest
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
    const local = block.empty
      ? 0
      : block.paragraph.getLineNumberAt(index - block.start + block.lead)
    const isLast = order === this.lineOffsets.length - 1
    if (local < 0) {
      if (isLast) return local
      return this.lineOffsets[order] + block.paragraph.getLineMetrics().length - 1
    }
    return this.lineOffsets[order] + local
  }

  getGlyphPositionAtCoordinate(x: number, y: number): PositionWithAffinity {
    return glyphPositionAt(this.ck, this.visibleBlocks(), this.placementOf, x, y)
  }

  getRectsForRange(
    start: number,
    end: number,
    heightStyle: RectHeightStyle,
    widthStyle: RectWidthStyle
  ): RectWithDirection[] {
    return rangeRects(this.visibleBlocks(), this.placementOf, start, end, heightStyle, widthStyle)
  }

  getCaretRect(index: number, rtl: boolean): TextCaretBox | null {
    const found = this.blockAt(index)
    if (!found) return null
    return caretRect(this.ck, found.block, this.placementOf(found.block), index, rtl)
  }

  getShapedLines(): ShapedLine[] {
    return textShapedLines(this.visibleBlocks(), this.lineOffset)
  }

  /** Markers of the visible list items, where layout placed them. */
  getMarkers(): TextLayoutMarker[] {
    const markers: TextLayoutMarker[] = []
    for (const block of this.visibleBlocks()) if (block.marker) markers.push(block.marker)
    return markers
  }

  /** Draws the text with every baseline on a whole pixel of its box, as Figma does. */
  draw(canvas: Canvas, x: number, y: number): void {
    this.drawing.draw(
      canvas,
      x,
      y,
      this.visibleBlocks(),
      this.lineOffset,
      (block) => this.placements.get(block)?.pieces
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
