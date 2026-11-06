import type {
  CanvasKit,
  PositionWithAffinity,
  RectHeightStyle,
  RectWidthStyle,
  RectWithDirection
} from 'canvaskit-wasm'

import { toTextIndex, type TextLayoutBlock } from '#core/canvas/text/layout/block'
import type { BlockPlacement } from '#core/canvas/text/layout/lines'

export interface TextCaretBox {
  x: number
  top: number
  bottom: number
}

export type PlacementOf = (block: TextLayoutBlock) => BlockPlacement | undefined

/** How far a point `y` of the block's paragraph moves, by the line it falls on. */
function offsetAt(
  block: TextLayoutBlock,
  placement: BlockPlacement | undefined,
  y: number
): number {
  if (!placement) return 0
  const lines = block.metrics
  const index = lines.findIndex((line) => y < line.baseline + line.descent)
  return placement.offsets[index === -1 ? lines.length - 1 : index] ?? 0
}

function blockHeight(block: TextLayoutBlock, placement: BlockPlacement | undefined): number {
  return placement?.height ?? block.paragraph.getHeight()
}

/** Where in the block's paragraph a point `y` below the block's top falls, by its line. */
function paragraphY(
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

export function glyphPositionAt(
  ck: CanvasKit,
  visible: readonly TextLayoutBlock[],
  placementOf: PlacementOf,
  x: number,
  y: number
): PositionWithAffinity {
  let block = visible.at(-1)
  for (const [index, candidate] of visible.entries()) {
    const next = visible.at(index + 1)
    const bottom = candidate.y + blockHeight(candidate, placementOf(candidate))
    if (!next || y < bottom + next.spaceBefore / 2) {
      block = candidate
      break
    }
  }
  if (!block) return { pos: 0, affinity: ck.Affinity.Downstream }
  const local = block.paragraph.getGlyphPositionAtCoordinate(
    x - block.x,
    paragraphY(block, placementOf(block), y - block.y)
  )
  return {
    pos: block.empty ? block.start : toTextIndex(block, local.pos),
    affinity: local.affinity
  }
}

export function rangeRects(
  visible: readonly TextLayoutBlock[],
  placementOf: PlacementOf,
  start: number,
  end: number,
  heightStyle: RectHeightStyle,
  widthStyle: RectWidthStyle
): RectWithDirection[] {
  const rects: RectWithDirection[] = []
  for (const block of visible) {
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
    const placement = placementOf(block)
    for (const { rect, dir } of local) {
      const y = block.y + offsetAt(block, placement, (rect[1] + rect[3]) / 2)
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
export function caretRect(
  ck: CanvasKit,
  block: TextLayoutBlock,
  placement: BlockPlacement | undefined,
  index: number,
  rtl: boolean
): TextCaretBox | null {
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
  const after = caretAfterLineBreak(block, placement, local)
  if (after) return after
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
  // The box of the whole character beside the caret: half an emoji or a surrogate pair has none.
  const cluster = block.paragraph.getGlyphInfoAt(lo + block.lead)?.graphemeClusterTextRange
  const rects = block.paragraph.getRectsForRange(
    cluster?.start ?? lo + block.lead,
    cluster?.end ?? hi + block.lead,
    ck.RectHeightStyle.Max,
    ck.RectWidthStyle.Tight
  )
  const rect = rects.at(0)?.rect
  if (!rect) return null
  const y = block.y + offsetAt(block, placement, (rect[1] + rect[3]) / 2)
  return {
    x: block.x + (useRight ? rect[2] : rect[0]),
    top: y + rect[1],
    bottom: y + rect[3]
  }
}

/**
 * The caret after a line break that ends the paragraph: at the start of the empty line Skia
 * lays out below it, where typing goes, not after the break on the line above.
 */
function caretAfterLineBreak(
  block: TextLayoutBlock,
  placement: BlockPlacement | undefined,
  local: number
): TextCaretBox | null {
  if (local < block.length) return null
  const lines = block.paragraph.getLineMetrics()
  const last = lines.at(-1)
  const previous = lines.at(-2)
  if (!last || !previous?.isHardBreak || last.endIndex > previous.endIncludingNewline) return null
  const lineTop = last.baseline - last.ascent
  const y = block.y + offsetAt(block, placement, lineTop + last.height / 2)
  return { x: block.x + last.left, top: y + lineTop, bottom: y + lineTop + last.height }
}
