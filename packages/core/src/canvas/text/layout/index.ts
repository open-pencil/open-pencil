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
  x: number
  y: number
  /** Whether the block is shown, as truncation hides blocks past its last line. */
  visible: boolean
}

export interface TextCaretBox {
  x: number
  top: number
  bottom: number
}

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

  /** Text laid out as one native paragraph of `length` characters, not yet laid out. */
  static ofParagraph(ck: CanvasKit, paragraph: Paragraph, length: number): TextLayout {
    return new TextLayout(ck, [
      {
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
        x: 0,
        y: 0,
        visible: true
      }
    ])
  }

  constructor(
    private readonly ck: CanvasKit,
    readonly blocks: TextLayoutBlock[],
    /** Lines the text may show in all, when it is truncated across blocks. */
    private readonly maxLines?: number
  ) {}

  /** The line cap a block's paragraph was rebuilt with, when it differs from `maxLines`. */
  private readonly caps = new Map<TextLayoutBlock, number>()

  private visibleBlocks(): TextLayoutBlock[] {
    return this.blocks.filter((block) => block.visible)
  }

  layout(width: number): void {
    let y = 0
    let lines = 0
    this.truncated = false
    for (const [index, block] of this.blocks.entries()) {
      const remaining = this.maxLines === undefined ? Infinity : this.maxLines - lines
      block.visible = remaining > 0
      if (!block.visible) {
        this.truncated = true
        continue
      }
      block.paragraph.layout(Math.max(1, width - block.inset))
      // A block capped for a narrower layout gets its lines back when there is room for them.
      const cap = this.caps.get(block) ?? this.maxLines ?? Infinity
      const overflows = block.paragraph.getLineMetrics().length > remaining
      const clipped = cap < remaining && block.paragraph.didExceedMaxLines()
      if ((overflows || clipped) && block.rebuild) {
        block.paragraph.delete()
        block.paragraph = block.rebuild(remaining)
        this.caps.set(block, remaining)
        block.paragraph.layout(Math.max(1, width - block.inset))
      }
      if (block.paragraph.didExceedMaxLines()) this.truncated = true
      if (index > 0) y += block.spaceBefore
      block.x = block.rtl ? 0 : block.inset
      block.y = y
      y += block.paragraph.getHeight()
      lines += block.paragraph.getLineMetrics().length
      this.placeMarker(block)
    }
    this.collectLines()
  }

  private placeMarker(block: TextLayoutBlock): void {
    const marker = block.marker
    const first = block.paragraph.getLineMetrics().at(0)
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
      const metrics = block.paragraph.getLineMetrics()
      const blockEnd = block.start + block.length
      for (const [lineIndex, line] of metrics.entries()) {
        const lastOfBlock = lineIndex === metrics.length - 1
        const endsAtNewline = lastOfBlock && blockIndex < visible.length - 1
        // A first-line indent is room before the text, not part of the line.
        const indent = lineIndex === 0 ? block.leadWidth : 0
        this.lines.push({
          ...line,
          startIndex: this.toTextIndex(block, line.startIndex),
          endIndex: this.toTextIndex(block, line.endIndex),
          endExcludingWhitespaces: this.toTextIndex(block, line.endExcludingWhitespaces),
          endIncludingNewline: endsAtNewline
            ? blockEnd + 1
            : this.toTextIndex(block, line.endIncludingNewline),
          isHardBreak: endsAtNewline || line.isHardBreak,
          width: block.empty ? 0 : line.width - indent,
          left: line.left + block.x + (block.rtl ? 0 : indent),
          baseline: line.baseline + block.y,
          lineNumber: this.lines.length
        })
      }
    }
  }

  getHeight(): number {
    const last = this.visibleBlocks().at(-1)
    return last ? last.y + last.paragraph.getHeight() : 0
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
      const bottom = candidate.y + candidate.paragraph.getHeight()
      if (!next || y < bottom + next.spaceBefore / 2) {
        block = candidate
        break
      }
    }
    if (!block) return { pos: 0, affinity: this.ck.Affinity.Downstream }
    const local = block.paragraph.getGlyphPositionAtCoordinate(x - block.x, y - block.y)
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
        rects.push({
          rect: Float32Array.of(
            rect[0] + block.x,
            rect[1] + block.y,
            rect[2] + block.x,
            rect[3] + block.y
          ),
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
    const local = index - block.start
    const first = block.paragraph.getLineMetrics().at(0)
    if (block.empty || block.length === 0) {
      if (!first) return null
      const top = block.y + first.baseline - first.ascent
      // The caret stands where typing starts: after a first-line indent.
      return {
        x: block.x + first.left + (rtl ? first.width - block.leadWidth : block.leadWidth),
        top,
        bottom: top + first.height
      }
    }
    let lo = local
    let hi = local + 1
    let useRight = false
    if (local <= 0) {
      lo = 0
      hi = 1
      useRight = rtl
    } else if (local >= block.length) {
      lo = block.length - 1
      hi = block.length
      useRight = !rtl
    }
    const rects = block.paragraph.getRectsForRange(
      lo + block.lead,
      hi + block.lead,
      this.ck.RectHeightStyle.Max,
      this.ck.RectWidthStyle.Tight
    )
    const rect = rects.at(0)?.rect
    if (!rect) return null
    return {
      x: block.x + (useRight ? rect[2] : rect[0]),
      top: block.y + rect[1],
      bottom: block.y + rect[3]
    }
  }

  /**
   * Shaped lines of the text in whole-text coordinates; run offsets are UTF-8 byte offsets into
   * the whole text, as CanvasKit gives them. An empty paragraph's line has no runs.
   */
  getShapedLines(): ShapedLine[] {
    const shaped: ShapedLine[] = []
    for (const block of this.visibleBlocks()) {
      for (const line of block.paragraph.getShapedLines()) {
        shaped.push({
          textRange: {
            first: this.toUtf8(block, line.textRange.first),
            last: this.toUtf8(block, line.textRange.last)
          },
          top: line.top + block.y,
          bottom: line.bottom + block.y,
          baseline: line.baseline + block.y,
          runs: block.empty
            ? []
            : line.runs.map((run) => ({
                ...run,
                positions: run.positions.map(
                  (value, index) => value + (index % 2 === 0 ? block.x : block.y)
                ),
                offsets: run.offsets.map((offset) => this.toUtf8(block, offset))
              }))
        })
      }
    }
    return shaped
  }

  private toUtf8(block: TextLayoutBlock, offset: number): number {
    return block.empty ? block.utf8Start : block.utf8Start + Math.max(0, offset - block.utf8Lead)
  }

  /** Markers of the visible list items, where layout placed them. */
  getMarkers(): TextLayoutMarker[] {
    const markers: TextLayoutMarker[] = []
    for (const block of this.visibleBlocks()) if (block.marker) markers.push(block.marker)
    return markers
  }

  draw(canvas: Canvas, x: number, y: number): void {
    for (const block of this.visibleBlocks()) {
      canvas.drawParagraph(block.paragraph, x + block.x, y + block.y)
      const marker = block.marker
      if (marker) canvas.drawParagraph(marker.paragraph, x + marker.x, y + marker.y)
    }
  }

  isDeleted(): boolean {
    return this.blocks.every((block) => block.paragraph.isDeleted())
  }

  delete(): void {
    for (const block of this.blocks) {
      block.paragraph.delete()
      block.marker?.paragraph.delete()
    }
  }
}
