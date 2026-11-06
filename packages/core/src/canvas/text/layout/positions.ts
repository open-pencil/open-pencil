import type {
  CanvasKit,
  LineMetrics,
  PositionWithAffinity,
  RectHeightStyle,
  RectWidthStyle,
  RectWithDirection
} from 'canvaskit-wasm'
import { uniq } from 'es-toolkit'

import type { Vector } from '@open-pencil/scene-graph/primitives'

import {
  joinerTailShift,
  tailShift,
  toCharacterIndex,
  toParagraphIndex,
  toTextIndex,
  type TextLayoutBlock
} from '#core/canvas/text/layout/block'
import type { BlockPlacement } from '#core/canvas/text/layout/lines'

export interface TextCaretBox {
  x: number
  top: number
  bottom: number
}

export type PlacementOf = (block: TextLayoutBlock) => BlockPlacement | undefined

export type LineShift = (block: TextLayoutBlock, index: number) => number

export interface PlacedBlocks {
  placementOf: PlacementOf
  lineShift: LineShift
}

const lineBottoms = new WeakMap<readonly LineMetrics[], number[]>()

function bottomsOf(lines: readonly LineMetrics[]): number[] {
  const cached = lineBottoms.get(lines)
  if (cached) {
    return cached
  }
  let bottom = 0
  const bottoms = lines.map((line) => (bottom += line.height))
  lineBottoms.set(lines, bottoms)
  return bottoms
}

function paragraphLineAt(block: TextLayoutBlock, y: number): number {
  const bottoms = bottomsOf(block.metrics)
  let low = 0
  let high = bottoms.length - 1
  while (low < high) {
    const middle = (low + high) >> 1
    if (y < bottoms[middle]) {
      high = middle
    } else {
      low = middle + 1
    }
  }
  return high
}

/** How far a point `y` of the block's paragraph moves, by the line it falls on. */
function moveAt(placed: PlacedBlocks, block: TextLayoutBlock, y: number): Vector {
  const index = paragraphLineAt(block, y)
  return {
    x: placed.lineShift(block, index),
    y: placed.placementOf(block)?.offsets[index] ?? 0
  }
}

function blockHeight(block: TextLayoutBlock, placement: BlockPlacement | undefined): number {
  return placement?.height ?? block.paragraph.getHeight()
}

function placedLineAt(
  block: TextLayoutBlock,
  placement: BlockPlacement | undefined,
  y: number
): number {
  if (!placement) {
    return paragraphLineAt(block, y)
  }
  const lines = block.metrics
  // A point belongs to the line whose box it is in, or the nearest after the one above it.
  const index = lines.findIndex((line, lineIndex) => {
    const box = placement.boxes[lineIndex]
    const baseline = line.baseline + placement.offsets[lineIndex]
    return y < baseline - box.ascent + box.height
  })
  return index === -1 ? lines.length - 1 : index
}

export function glyphPositionAt(
  ck: CanvasKit,
  visible: readonly TextLayoutBlock[],
  placed: PlacedBlocks,
  x: number,
  y: number
): PositionWithAffinity {
  let block = visible.at(-1)
  for (const [index, candidate] of visible.entries()) {
    const next = visible.at(index + 1)
    const bottom = candidate.y + blockHeight(candidate, placed.placementOf(candidate))
    if (!next || y < bottom + next.spaceBefore / 2) {
      block = candidate
      break
    }
  }
  if (!block) return { pos: 0, affinity: ck.Affinity.Downstream }
  const placement = placed.placementOf(block)
  const line = placedLineAt(block, placement, y - block.y)
  const paragraphY = placement ? (block.metrics.at(line)?.baseline ?? 0) : y - block.y
  const lineX = x - block.x - placed.lineShift(block, line)
  const boxes = block.empty ? [] : lineEndBoxes(ck, block, line)
  const first = boxes.at(0)
  if (first && lineX >= first.left) {
    return hitInBoxes(ck, boxes, lineX)
  }
  const local = block.paragraph.getGlyphPositionAtCoordinate(lineX, paragraphY)
  return {
    pos: block.empty ? block.start : toTextIndex(block, local.pos),
    affinity: local.affinity
  }
}

interface CharacterBox {
  start: number
  end: number
  left: number
  right: number
}

// Skia's own hit test reads a joiner's step back as glyphs out of order.
function lineEndBoxes(ck: CanvasKit, block: TextLayoutBlock, line: number): CharacterBox[] {
  const metrics = block.metrics.at(line)
  const tail =
    metrics &&
    block.joiners.joinerBetween(
      metrics.startIndex - block.lead,
      metrics.endIncludingNewline - block.lead
    )
  if (!tail) {
    return []
  }
  const shift = joinerTailShift(ck, block, tail)
  const tailStart = block.start + tail.at
  const lastGlyph = block.paragraph.getGlyphInfoAt(toParagraphIndex(block, tailStart) - 1)
  if (!lastGlyph) {
    return []
  }
  const boxes: CharacterBox[] = [
    {
      start: toTextIndex(block, lastGlyph.graphemeClusterTextRange.start),
      end: tailStart,
      left: lastGlyph.graphemeLayoutBounds[0],
      right: lastGlyph.graphemeLayoutBounds[2]
    }
  ]
  for (let index = tailStart; index < block.start + tail.tailEnd; index++) {
    const character = toCharacterIndex(block, index)
    const rect = block.paragraph
      .getRectsForRange(character, character + 1, ck.RectHeightStyle.Tight, ck.RectWidthStyle.Tight)
      .at(0)?.rect
    if (rect && rect[2] > rect[0]) {
      boxes.push({
        start: index,
        end: index + 1,
        left: rect[0] + shift,
        right: rect[2] + shift
      })
    }
  }
  return boxes
}

function hitInBoxes(
  ck: CanvasKit,
  boxes: readonly CharacterBox[],
  x: number
): PositionWithAffinity {
  let lineEnd = 0
  for (const box of boxes) {
    if (x < (box.left + box.right) / 2) {
      return { pos: box.start, affinity: ck.Affinity.Downstream }
    }
    if (x < box.right) {
      return { pos: box.end, affinity: ck.Affinity.Upstream }
    }
    lineEnd = box.end
  }
  return { pos: lineEnd, affinity: ck.Affinity.Upstream }
}

function tailPieces(block: TextLayoutBlock, from: number, to: number): [number, number][] {
  const cuts: number[] = []
  for (const tail of block.joiners.tailsBetween(from - block.start, to - block.start)) {
    cuts.push(block.start + tail.at, block.start + tail.tailEnd)
  }
  const inside = cuts.filter((cut) => cut > from && cut < to)
  const bounds = [from, ...uniq(inside), to]
  return bounds.slice(1).map((end, index) => [bounds[index], end])
}

export function rangeRects(
  ck: CanvasKit,
  visible: readonly TextLayoutBlock[],
  placed: PlacedBlocks,
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
    for (const [pieceFrom, pieceTo] of tailPieces(block, from, to)) {
      const local = block.paragraph.getRectsForRange(
        toCharacterIndex(block, pieceFrom),
        toParagraphIndex(block, pieceTo),
        heightStyle,
        widthStyle
      )
      const shift = tailShift(ck, block, pieceFrom)
      for (const { rect, dir } of local) {
        const move = moveAt(placed, block, (rect[1] + rect[3]) / 2)
        const x = block.x + move.x + shift
        const y = block.y + move.y
        rects.push({
          rect: Float32Array.of(rect[0] + x, rect[1] + y, rect[2] + x, rect[3] + y),
          dir
        })
      }
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
  placed: PlacedBlocks,
  index: number,
  rtl: boolean
): TextCaretBox | null {
  const local = index - block.start
  const first = block.paragraph.getLineMetrics().at(0)
  if (block.empty || block.length === 0) {
    if (!first) return null
    const top = block.y + first.baseline - first.ascent
    const lineStart = block.x + placed.lineShift(block, 0) + first.left
    // The caret stands where typing starts: after a first-line indent.
    return {
      x: lineStart + (rtl ? first.width - block.leadWidth : block.leadWidth),
      top,
      bottom: top + first.height
    }
  }
  const after = caretAfterLineBreak(block, placed, local) ?? caretAtSeam(ck, block, placed, local)
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
  const paragraphLo = toCharacterIndex(block, block.start + lo)
  const cluster = block.paragraph.getGlyphInfoAt(paragraphLo)?.graphemeClusterTextRange
  const rects = block.paragraph.getRectsForRange(
    cluster?.start ?? paragraphLo,
    cluster?.end ?? toParagraphIndex(block, block.start + hi),
    ck.RectHeightStyle.Max,
    ck.RectWidthStyle.Tight
  )
  const rect = rects.at(0)?.rect
  if (!rect) return null
  const move = moveAt(placed, block, (rect[1] + rect[3]) / 2)
  const y = block.y + move.y
  return {
    x: block.x + move.x + tailShift(ck, block, block.start + lo) + (useRight ? rect[2] : rect[0]),
    top: y + rect[1],
    bottom: y + rect[3]
  }
}

/**
 * The caret at the end of a group of a long joined text, where the newline after it would be:
 * at the joiner ending the group, since after a right-to-left word Skia puts a paragraph's
 * end elsewhere than its newline.
 */
function caretAtSeam(
  ck: CanvasKit,
  block: TextLayoutBlock,
  placed: PlacedBlocks,
  local: number
): TextCaretBox | null {
  const joiner = block.joiners.tails.at(-1)
  if (!block.endsAtSeam || local < block.length || joiner?.at !== block.length) {
    return null
  }
  const at = toParagraphIndex(block, block.start + joiner.at)
  const rect = block.paragraph
    .getRectsForRange(at, at + 1, ck.RectHeightStyle.Max, ck.RectWidthStyle.Tight)
    .at(0)?.rect
  if (!rect) {
    return null
  }
  const move = moveAt(placed, block, (rect[1] + rect[3]) / 2)
  const y = block.y + move.y
  return { x: block.x + move.x + rect[0], top: y + rect[1], bottom: y + rect[3] }
}

/**
 * The caret after a line break that ends the paragraph: at the start of the empty line Skia
 * lays out below it, where typing goes, not after the break on the line above.
 */
function caretAfterLineBreak(
  block: TextLayoutBlock,
  placed: PlacedBlocks,
  local: number
): TextCaretBox | null {
  if (local < block.length) return null
  const lines = block.paragraph.getLineMetrics()
  const last = lines.at(-1)
  const previous = lines.at(-2)
  if (!last || !previous?.isHardBreak || last.endIndex > previous.endIncludingNewline) return null
  const lineTop = last.baseline - last.ascent
  const move = moveAt(placed, block, lineTop + last.height / 2)
  const y = block.y + move.y
  return { x: block.x + move.x + last.left, top: y + lineTop, bottom: y + lineTop + last.height }
}
