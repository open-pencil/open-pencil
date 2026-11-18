import type { Canvas } from '@open-pencil/canvaskit'

import {
  type BlockPlacement,
  shapedLinesByLine,
  wholePixelShift
} from '#core/canvas/text/layout/lines'
import { lineOffset } from '#core/canvas/text/layout/placement'
import type { TextLayoutBlock } from '#core/canvas/text/layout/types'

/** How a block is drawn: each line's shift, `null` for one without glyphs, and its marker's. */
export interface BlockDrawing {
  lines: Array<number | null>
  marker: number
}

/**
 * How far the block's lines and marker move when the text's top stands `fraction` of a pixel
 * below a whole one, so every baseline lands on the whole pixel of the box its exact one rounds
 * to, as Figma draws it.
 */
export function blockDrawing(
  block: TextLayoutBlock,
  placement: BlockPlacement | undefined,
  fraction: number
): BlockDrawing {
  const shaped = shapedLinesByLine(block.paragraph)
  const lines = block.metrics.map((line, index) => {
    const drawn = shaped[index]
    if (!drawn || drawn.runs.length === 0) return null
    const lineTop = fraction + block.y + lineOffset(placement, index)
    return wholePixelShift(lineTop, line.baseline, drawn.baseline)
  })
  return { lines, marker: markerShift(block, fraction) }
}

function markerShift(block: TextLayoutBlock, fraction: number): number {
  const marker = block.marker
  const line = marker?.paragraph.getLineMetrics().at(0)
  const drawn = marker ? shapedLinesByLine(marker.paragraph).at(0) : undefined
  if (!marker || !line || !drawn) return 0
  return wholePixelShift(fraction + marker.y, line.baseline, drawn.baseline)
}

/** The shift of the first line from `line` on that draws glyphs. */
function firstShift(drawn: BlockDrawing | undefined, line: number): number {
  return drawn?.lines.slice(line).find((shift) => shift !== null) ?? 0
}

/** Draws the block, its pieces when its lines move apart, and its marker, shifted by `drawn`. */
export function drawBlock(
  canvas: Canvas,
  block: TextLayoutBlock,
  placement: BlockPlacement | undefined,
  drawn: BlockDrawing | undefined,
  x: number,
  y: number
): void {
  const pieces = placement?.pieces
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
