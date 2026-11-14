import type { ShapedLine } from '@open-pencil/canvaskit'

import { type BlockPlacement, shapedLinesByLine } from '#core/canvas/text/layout/lines'
import { lineOffset } from '#core/canvas/text/layout/placement'
import type { TextLayoutBlock } from '#core/canvas/text/layout/types'

/**
 * The block's shaped lines in whole-text coordinates, one per line; run offsets are UTF-8 byte
 * offsets into the whole text, as CanvasKit gives them. An empty line, which shaping leaves
 * out, has no runs and starts where the line before it ends.
 */
export function blockShapedLines(
  block: TextLayoutBlock,
  placement: BlockPlacement | undefined
): ShapedLine[] {
  const shaped: ShapedLine[] = []
  const metrics = block.paragraph.getLineMetrics()
  for (const [lineIndex, line] of shapedLinesByLine(block.paragraph).entries()) {
    const y = block.y + lineOffset(placement, lineIndex)
    if (!line) {
      const { baseline, ascent, descent } = metrics[lineIndex]
      const start = shaped.at(-1)?.textRange.last ?? block.utf8Start
      shaped.push({
        textRange: { first: start, last: start },
        top: baseline - ascent + y,
        bottom: baseline + descent + y,
        baseline: baseline + y,
        runs: []
      })
      continue
    }
    shaped.push({
      textRange: {
        first: toUtf8(block, line.textRange.first),
        last: toUtf8(block, line.textRange.last)
      },
      top: line.top + y,
      bottom: line.bottom + y,
      baseline: line.baseline + y,
      runs: block.empty
        ? []
        : line.runs.map((run) => ({
            ...run,
            positions: run.positions.map((value, index) => value + (index % 2 === 0 ? block.x : y)),
            offsets: run.offsets.map((offset) => toUtf8(block, offset))
          }))
    })
  }
  return shaped
}

function toUtf8(block: TextLayoutBlock, offset: number): number {
  return block.empty ? block.utf8Start : block.utf8Start + Math.max(0, offset - block.utf8Lead)
}
