import type { LineMetrics } from 'canvaskit-wasm'

import { spacedLineWidth, toTextIndex, type TextLayoutBlock } from '#core/canvas/text/layout/block'
import type { PlacedBlocks } from '#core/canvas/text/layout/positions'

export interface TextLines {
  lines: LineMetrics[]
  blockFirstLines: number[]
}

export function collectTextLines(
  visible: readonly TextLayoutBlock[],
  placed: PlacedBlocks
): TextLines {
  const lines: LineMetrics[] = []
  const blockFirstLines: number[] = []
  for (const [blockIndex, block] of visible.entries()) {
    blockFirstLines.push(lines.length)
    const metrics = block.metrics
    const placement = placed.placementOf(block)
    const boxes = placement?.boxes
    const blockEnd = block.start + block.length
    for (const [lineIndex, line] of metrics.entries()) {
      const lastOfBlock = lineIndex === metrics.length - 1
      const endsAtNewline = lastOfBlock && blockIndex < visible.length - 1
      // A first-line indent is room before the text, not part of the line.
      const indent = lineIndex === 0 ? block.leadWidth : 0
      const box = boxes?.[lineIndex]
      lines.push({
        ...line,
        ...(box && {
          ascent: box.ascent,
          descent: box.height - box.ascent,
          height: box.height
        }),
        startIndex: toTextIndex(block, line.startIndex),
        endIndex: toTextIndex(block, line.endIndex),
        endExcludingWhitespaces: toTextIndex(block, line.endExcludingWhitespaces),
        endIncludingNewline: endsAtNewline
          ? blockEnd + 1
          : toTextIndex(block, line.endIncludingNewline),
        isHardBreak: endsAtNewline || line.isHardBreak,
        width: block.empty ? 0 : spacedLineWidth(block, line) - indent,
        left: line.left + block.x + placed.lineShift(block, lineIndex) + (block.rtl ? 0 : indent),
        baseline: line.baseline + block.y + (placement?.offsets[lineIndex] ?? 0),
        lineNumber: lines.length
      })
    }
  }
  return { lines, blockFirstLines }
}
