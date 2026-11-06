import type { ShapedLine } from 'canvaskit-wasm'

import { toUtf8, type TextLayoutBlock } from '#core/canvas/text/layout/block'
import { shapedLinesByLine } from '#core/canvas/text/layout/lines'

/**
 * Shaped lines of the text in whole-text coordinates, one per line; run offsets are UTF-8
 * byte offsets into the whole text, as CanvasKit gives them. An empty line, which shaping
 * leaves out, has no runs and starts where the line before it ends.
 */
export function textShapedLines(
  visible: readonly TextLayoutBlock[],
  lineOffset: (block: TextLayoutBlock, index: number) => number
): ShapedLine[] {
  const shaped: ShapedLine[] = []
  for (const block of visible) {
    const metrics = block.paragraph.getLineMetrics()
    for (const [lineIndex, line] of shapedLinesByLine(block.paragraph).entries()) {
      const y = block.y + lineOffset(block, lineIndex)
      if (!line) {
        const { baseline, ascent, descent } = metrics[lineIndex]
        const previous = lineIndex > 0 ? shaped.at(-1) : undefined
        const start = previous?.textRange.last ?? block.utf8Start
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
              positions: run.positions.map(
                (value, index) => value + (index % 2 === 0 ? block.x : y)
              ),
              offsets: run.offsets.map((offset) => toUtf8(block, offset))
            }))
      })
    }
  }
  return shaped
}
