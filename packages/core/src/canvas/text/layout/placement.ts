import type { BlockPlacement } from '#core/canvas/text/layout/lines'
import type { TextLayoutBlock } from '#core/canvas/text/layout/types'

/** The block's line `index` stands this far below where its paragraph has it. */
export function lineOffset(placement: BlockPlacement | undefined, index: number): number {
  return placement?.offsets[index] ?? 0
}

/** How far a point `y` of the block's paragraph moves, by the line it falls on. */
export function offsetAt(
  block: TextLayoutBlock,
  placement: BlockPlacement | undefined,
  y: number
): number {
  if (!placement) return 0
  const lines = block.metrics
  const index = lines.findIndex((line) => y < line.baseline + line.descent)
  return placement.offsets[index === -1 ? lines.length - 1 : index] ?? 0
}

/** Where in the block's paragraph a point `y` below the block's top falls, by its line. */
export function paragraphY(
  block: TextLayoutBlock,
  placement: BlockPlacement | undefined,
  y: number
): number {
  if (!placement) return y
  const lines = block.paragraph.getLineMetrics()
  // A point belongs to the line whose box it is in, or the nearest after the one above it.
  const index = lines.findIndex((line, lineIndex) => {
    const box = placement.boxes[lineIndex]
    const baseline = line.baseline + placement.offsets[lineIndex]
    return y < baseline - box.ascent + box.height
  })
  const line = lines[index === -1 ? lines.length - 1 : index]
  return line.baseline
}
