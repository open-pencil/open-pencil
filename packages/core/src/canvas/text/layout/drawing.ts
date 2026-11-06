import type { Canvas } from 'canvaskit-wasm'

import type { TextLayoutBlock } from '#core/canvas/text/layout/block'
import { shapedLinesByLine, wholePixelShift, type LinePiece } from '#core/canvas/text/layout/lines'

/** How a block is drawn: each line's shift, `null` for one without glyphs, and its marker's. */
interface BlockDrawing {
  lines: Array<number | null>
  marker: number
}

/** Fractions of a pixel a text is drawn below its top at that keep their drawing. */
const MAX_DRAWN_FRACTIONS = 4

type LineOffset = (block: TextLayoutBlock, index: number) => number

/** The shift of the first line from `line` on that draws glyphs. */
function firstShift(drawn: BlockDrawing | undefined, line: number): number {
  return drawn?.lines.slice(line).find((shift) => shift !== null) ?? 0
}

function markerShift(block: TextLayoutBlock, fraction: number): number {
  const marker = block.marker
  const line = marker?.paragraph.getLineMetrics().at(0)
  const drawn = marker ? shapedLinesByLine(marker.paragraph).at(0) : undefined
  if (!marker || !line || !drawn) return 0
  return wholePixelShift(fraction + marker.y, line.baseline, drawn.baseline)
}

/**
 * Draws a text's blocks with every baseline on a whole pixel of its box, as Figma does, keeping
 * how each block is drawn below a top of a given fraction of a pixel, worked out on the first
 * draw there after a layout.
 */
export class TextDrawing {
  private readonly fractions = new Map<number, Map<TextLayoutBlock, BlockDrawing>>()

  clear(): void {
    this.fractions.clear()
  }

  /**
   * Works out how far each block's lines and marker move when the text is drawn `top` down, so
   * every baseline lands on the whole pixel of the box its exact one rounds to, as Figma draws it,
   * a vertical alignment's offset included. Lines a paragraph or piece draws together step by
   * whole pixels both as it draws them and as they are placed, so they move as one.
   */
  private prepare(
    top: number,
    visible: readonly TextLayoutBlock[],
    lineOffset: LineOffset
  ): Map<TextLayoutBlock, BlockDrawing> {
    const fraction = top - Math.floor(top)
    const cached = this.fractions.get(fraction)
    if (cached) return cached
    const drawing = new Map<TextLayoutBlock, BlockDrawing>()
    for (const block of visible) {
      const shaped = shapedLinesByLine(block.paragraph)
      const lines = block.metrics.map((line, index) => {
        const drawn = shaped[index]
        if (!drawn || drawn.runs.length === 0) return null
        const lineTop = fraction + block.y + lineOffset(block, index)
        return wholePixelShift(lineTop, line.baseline, drawn.baseline)
      })
      drawing.set(block, { lines, marker: markerShift(block, fraction) })
    }
    if (this.fractions.size >= MAX_DRAWN_FRACTIONS) this.fractions.clear()
    this.fractions.set(fraction, drawing)
    return drawing
  }

  draw(
    canvas: Canvas,
    x: number,
    y: number,
    visible: readonly TextLayoutBlock[],
    lineOffset: LineOffset,
    piecesOf: (block: TextLayoutBlock) => LinePiece[] | null | undefined
  ): void {
    const drawing = this.prepare(y, visible, lineOffset)
    for (const block of visible) {
      const drawn = drawing.get(block)
      const pieces = piecesOf(block)
      if (!pieces) {
        canvas.drawParagraph(block.paragraph, x + block.x, y + block.y + firstShift(drawn, 0))
      }
      for (const piece of pieces ?? []) {
        const top = y + block.y + piece.y + firstShift(drawn, piece.line)
        canvas.drawParagraph(piece.paragraph, x + block.x + piece.x, top)
      }
      const marker = block.marker
      if (marker) {
        canvas.drawParagraph(marker.paragraph, x + marker.x, y + marker.y + (drawn?.marker ?? 0))
      }
    }
  }
}
