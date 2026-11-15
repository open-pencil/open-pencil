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

import { blockCaretRect } from '#core/canvas/text/layout/caret'
import { type BlockDrawing, blockDrawing, drawBlock } from '#core/canvas/text/layout/drawing'
import {
  figmaLineBox,
  placeLines,
  type BlockPlacement,
  type TextLayoutBlockLines
} from '#core/canvas/text/layout/lines'
import { lineOffset, offsetAt, paragraphY } from '#core/canvas/text/layout/placement'
import { blockShapedLines } from '#core/canvas/text/layout/shaped'
import type {
  LineCapHeight,
  TextCaretBox,
  TextLayoutBlock,
  TextLayoutMarker
} from '#core/canvas/text/layout/types'

export type {
  LineCapHeight,
  TextCaretBox,
  TextLayoutBlock,
  TextLayoutMarker
} from '#core/canvas/text/layout/types'

/** Fractions of a pixel a text is drawn below its top at that keep their drawing. */
const MAX_DRAWN_FRACTIONS = 4

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
  /**
   * How each block is drawn below a top of a given fraction of a pixel, worked out on the first
   * draw there after a layout (`prepareDrawing`).
   */
  private readonly drawing = new Map<number, Map<TextLayoutBlock, BlockDrawing>>()
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
    const block: TextLayoutBlock = {
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
    return new TextLayout(ck, [block], undefined, capHeight)
  }

  constructor(
    private readonly ck: CanvasKit,
    readonly blocks: TextLayoutBlock[],
    /** Lines the text may show in all, when it is truncated across blocks. */
    private readonly maxLines?: number,
    private readonly capHeight?: LineCapHeight
  ) {}

  /** The line cap a block's paragraph was rebuilt with, when it differs from `maxLines`. */
  private readonly caps = new Map<TextLayoutBlock, number>()
  private readonly capHeights = new Map<string, number>()

  private visibleBlocks(): TextLayoutBlock[] {
    return this.blocks.filter((block) => block.visible)
  }

  layout(width: number): void {
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
        this.capHeights.clear()
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
    this.placeLines(width)
    this.alignFirstBaseline()
    this.trimToCapHeight()
    for (const block of this.visibleBlocks()) this.placeMarker(block)
    this.collectLines()
    this.height = this.measureHeight()
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

  /**
   * Puts the first baseline where Figma does, its font centred in its line height, when lines
   * keep the paragraph's placement, which centres it a little apart. The height stays, but a
   * single line is as tall as its line height, which a paragraph rounds and ignores at zero.
   */
  private alignFirstBaseline(): void {
    if (this.placedHeight !== null) return
    const visible = this.visibleBlocks()
    const first = visible.at(0)
    const line = first?.metrics.at(0)
    const heights = first?.lines?.heights
    if (!first || !line || !heights) return
    const box = figmaLineBox(this.ck, first.paragraph, line, heights, first.metrics)
    if (!box) return
    const single = visible.length === 1 && first.metrics.length === 1
    const shift = box.ascent - this.firstBaseline(first)
    if (shift === 0 && !single) return
    this.placedHeight = single ? box.height : this.measureHeight()
    for (const block of visible) block.y += shift
  }

  /** Trims the text from its first line's cap height to its last baseline, as Figma does. */
  private trimToCapHeight(): void {
    const visible = this.visibleBlocks()
    const first = visible.at(0)
    const last = visible.at(-1)
    if (this.capHeight === undefined || !first || !last) {
      return
    }
    const firstBaseline = this.firstBaseline(first)
    const lastLine = last.metrics.at(-1)
    const lastBaseline = lastLine
      ? last.y + lastLine.baseline + this.lineOffset(last, last.metrics.length - 1)
      : firstBaseline
    // Figma starts the box at the first line's cap height and makes it as tall as the last
    // baseline stands below that, to the nearest pixel, so the last baseline drawn on a whole
    // pixel ends it (Figma desktop 126).
    const top = firstBaseline - this.firstLineCapHeight(first, this.capHeight)
    for (const block of visible) {
      block.y -= top
    }
    this.placedHeight = Math.round(lastBaseline - top)
  }

  /** Skia lays an empty paragraph out without lines, but with a baseline. */
  private firstBaseline(block: TextLayoutBlock): number {
    const line = block.metrics.at(0)
    if (!line) {
      return block.y + block.paragraph.getAlphabeticBaseline()
    }
    return block.y + line.baseline + this.lineOffset(block, 0)
  }

  private firstLineCapHeight(block: TextLayoutBlock, capHeight: LineCapHeight): number {
    const line = block.metrics.at(0)
    const start = line ? this.toTextIndex(block, line.startIndex) : block.start
    const end = line ? this.toTextIndex(block, line.endIndex) : block.start
    const key = `${start}:${end}`
    let height = this.capHeights.get(key)
    if (height === undefined) {
      height = capHeight(start, end)
      this.capHeights.set(key, height)
    }
    return height
  }

  /** The block's line `index` stands this far below where its paragraph has it. */
  private lineOffset(block: TextLayoutBlock, index: number): number {
    return lineOffset(this.placements.get(block), index)
  }

  private blockHeight(block: TextLayoutBlock): number {
    return this.placements.get(block)?.height ?? block.paragraph.getHeight()
  }

  private placeMarker(block: TextLayoutBlock): void {
    const marker = block.marker
    const first = block.metrics.at(0)
    if (!marker || !first) return
    const markerLine = marker.paragraph.getLineMetrics().at(0)
    const width = marker.paragraph.getLongestLine()
    // A bullet centres on the middle of the indent; a number ends a third of an em before the
    // text, so numbers of any width line up on their periods.
    if (block.rtl) {
      const start = block.x + first.left + first.width
      marker.x =
        marker.kind === 'bullet' ? start + marker.em * 0.75 - width / 2 : start + marker.em / 3
    } else {
      const start = block.x + first.left
      marker.x =
        marker.kind === 'bullet'
          ? start - marker.em * 0.75 - width / 2
          : start - marker.em / 3 - width
    }
    marker.y = block.y + first.baseline - (markerLine?.baseline ?? 0)
  }

  private toTextIndex(block: TextLayoutBlock, index: number): number {
    return block.start + Math.max(0, Math.min(block.length, index - block.lead))
  }

  private collectLines(): void {
    this.lines = []
    this.lineOffsets = []
    const visible = this.visibleBlocks()
    for (const [blockIndex, block] of visible.entries()) {
      this.lineOffsets.push(this.lines.length)
      if (block.marker) block.marker.lineNumber = this.lines.length
      const metrics = block.metrics
      const boxes = this.placements.get(block)?.boxes
      const blockEnd = block.start + block.length
      for (const [lineIndex, line] of metrics.entries()) {
        const lastOfBlock = lineIndex === metrics.length - 1
        const endsAtNewline = lastOfBlock && blockIndex < visible.length - 1
        // A first-line indent is room before the text, not part of the line.
        const indent = lineIndex === 0 ? block.leadWidth : 0
        const box = boxes?.[lineIndex]
        this.lines.push({
          ...line,
          ...(box && {
            ascent: box.ascent,
            descent: box.height - box.ascent,
            height: box.height
          }),
          startIndex: this.toTextIndex(block, line.startIndex),
          endIndex: this.toTextIndex(block, line.endIndex),
          endExcludingWhitespaces: this.toTextIndex(block, line.endExcludingWhitespaces),
          endIncludingNewline: endsAtNewline
            ? blockEnd + 1
            : this.toTextIndex(block, line.endIncludingNewline),
          isHardBreak: endsAtNewline || line.isHardBreak,
          width: block.empty ? 0 : line.width - indent,
          left: line.left + block.x + (block.rtl ? 0 : indent),
          baseline: line.baseline + block.y + this.lineOffset(block, lineIndex),
          lineNumber: this.lines.length
        })
      }
    }
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
    const visible = this.visibleBlocks()
    let block = visible.at(-1)
    for (const [index, candidate] of visible.entries()) {
      const next = visible.at(index + 1)
      const bottom = candidate.y + this.blockHeight(candidate)
      if (!next || y < bottom + next.spaceBefore / 2) {
        block = candidate
        break
      }
    }
    if (!block) return { pos: 0, affinity: this.ck.Affinity.Downstream }
    const local = block.paragraph.getGlyphPositionAtCoordinate(
      x - block.x,
      paragraphY(block, this.placements.get(block), y - block.y)
    )
    return {
      pos: block.empty ? block.start : this.toTextIndex(block, local.pos),
      affinity: local.affinity
    }
  }

  getRectsForRange(
    start: number,
    end: number,
    heightStyle: RectHeightStyle,
    widthStyle: RectWidthStyle
  ): RectWithDirection[] {
    const rects: RectWithDirection[] = []
    for (const block of this.visibleBlocks()) {
      if (block.empty) continue
      const from = Math.max(start, block.start)
      const to = Math.min(end, block.start + block.length)
      if (to <= from) continue
      const local = block.paragraph.getRectsForRange(
        from - block.start + block.lead,
        to - block.start + block.lead,
        heightStyle,
        widthStyle
      )
      for (const { rect, dir } of local) {
        const y = block.y + offsetAt(block, this.placements.get(block), (rect[1] + rect[3]) / 2)
        rects.push({
          rect: Float32Array.of(rect[0] + block.x, rect[1] + y, rect[2] + block.x, rect[3] + y),
          dir
        })
      }
    }
    return rects
  }

  /**
   * Where the caret stands before text index `index`: at the start edge of the character
   * there, or after the last character of its paragraph.
   */
  getCaretRect(index: number, rtl: boolean): TextCaretBox | null {
    const found = this.blockAt(index)
    if (!found) return null
    const { block } = found
    return blockCaretRect(this.ck, block, this.placements.get(block), index - block.start, rtl)
  }

  /**
   * Shaped lines of the text in whole-text coordinates, one per line; run offsets are UTF-8
   * byte offsets into the whole text, as CanvasKit gives them. An empty line, which shaping
   * leaves out, has no runs and starts where the line before it ends.
   */
  getShapedLines(): ShapedLine[] {
    return this.visibleBlocks().flatMap((block) =>
      blockShapedLines(block, this.placements.get(block))
    )
  }

  /** Markers of the visible list items, where layout placed them. */
  getMarkers(): TextLayoutMarker[] {
    const markers: TextLayoutMarker[] = []
    for (const block of this.visibleBlocks()) if (block.marker) markers.push(block.marker)
    return markers
  }

  /**
   * Works out how far each block's lines and marker move when the text is drawn `top` down, so
   * every baseline lands on the whole pixel of the box its exact one rounds to, as Figma draws it,
   * a vertical alignment's offset included. Lines a paragraph or piece draws together step by
   * whole pixels both as it draws them and as they are placed, so they move as one.
   */
  private prepareDrawing(top: number): Map<TextLayoutBlock, BlockDrawing> {
    const fraction = top - Math.floor(top)
    const cached = this.drawing.get(fraction)
    if (cached) return cached
    const drawing = new Map<TextLayoutBlock, BlockDrawing>()
    for (const block of this.visibleBlocks()) {
      drawing.set(block, blockDrawing(block, this.placements.get(block), fraction))
    }
    if (this.drawing.size >= MAX_DRAWN_FRACTIONS) this.drawing.clear()
    this.drawing.set(fraction, drawing)
    return drawing
  }

  /** Draws the text with every baseline on a whole pixel of its box, as Figma does. */
  draw(canvas: Canvas, x: number, y: number): void {
    const drawing = this.prepareDrawing(y)
    for (const block of this.visibleBlocks()) {
      drawBlock(canvas, block, this.placements.get(block), drawing.get(block), x, y)
    }
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
