import type { CanvasKit } from '@open-pencil/canvaskit'

import type { BlockPlacement } from '#core/canvas/text/layout/lines'
import { offsetAt } from '#core/canvas/text/layout/placement'
import type { TextCaretBox, TextLayoutBlock } from '#core/canvas/text/layout/types'

/**
 * Where the caret stands before the block's character `local`: at the start edge of the
 * character there, or after the last character of its paragraph.
 */
export function blockCaretRect(
  ck: CanvasKit,
  block: TextLayoutBlock,
  placement: BlockPlacement | undefined,
  local: number,
  rtl: boolean
): TextCaretBox | null {
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
