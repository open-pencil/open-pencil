import type { CanvasKit } from '@open-pencil/canvaskit'

import { toTextIndex, type TextLayoutBlock } from '#core/canvas/text/layout/block'
import { figmaLineBox } from '#core/canvas/text/layout/lines'

export type LineCapHeight = (start: number, end: number) => number

type LineOffset = (block: TextLayoutBlock, index: number) => number

export class FirstLineCapHeights {
  private readonly heights = new Map<string, number>()

  constructor(private readonly capHeight: LineCapHeight) {}

  clear(): void {
    this.heights.clear()
  }

  of(block: TextLayoutBlock): number {
    const line = block.metrics.at(0)
    const start = line ? toTextIndex(block, line.startIndex) : block.start
    const end = line ? toTextIndex(block, line.endIndex) : block.start
    const key = `${start}:${end}`
    let height = this.heights.get(key)
    if (height === undefined) {
      height = this.capHeight(start, end)
      this.heights.set(key, height)
    }
    return height
  }
}

/** Skia lays an empty paragraph out without lines, but with a baseline. */
export function firstBaseline(block: TextLayoutBlock, lineOffset: LineOffset): number {
  const line = block.metrics.at(0)
  if (!line) {
    return block.y + block.paragraph.getAlphabeticBaseline()
  }
  return block.y + line.baseline + lineOffset(block, 0)
}

/**
 * Puts the first baseline where Figma does, its font centred in its line height, when lines
 * keep the paragraph's placement, which centres it a little apart. The height stays, but a
 * single line is as tall as its line height, which a paragraph rounds and ignores at zero.
 * Returns the text's height when the blocks moved.
 */
export function alignFirstBaseline(
  ck: CanvasKit,
  visible: readonly TextLayoutBlock[],
  lineOffset: LineOffset,
  measureHeight: () => number
): number | null {
  const first = visible.at(0)
  const line = first?.metrics.at(0)
  const heights = first?.lines?.heights
  if (!first || !line || !heights) return null
  const box = figmaLineBox(ck, first.paragraph, line, heights, first.metrics)
  if (!box) return null
  const single = visible.length === 1 && first.metrics.length === 1
  const shift = box.ascent - firstBaseline(first, lineOffset)
  if (shift === 0 && !single) return null
  const height = single ? box.height : measureHeight()
  for (const block of visible) block.y += shift
  return height
}

/**
 * Trims the text from its first line's cap height to its last baseline, as Figma does, and
 * returns its height.
 */
export function trimToCapHeight(
  visible: readonly TextLayoutBlock[],
  lineOffset: LineOffset,
  capHeights: FirstLineCapHeights
): number | null {
  const first = visible.at(0)
  const last = visible.at(-1)
  if (!first || !last) {
    return null
  }
  const baseline = firstBaseline(first, lineOffset)
  const lastLine = last.metrics.at(-1)
  const lastBaseline = lastLine
    ? last.y + lastLine.baseline + lineOffset(last, last.metrics.length - 1)
    : baseline
  // Figma starts the box at the first line's cap height and makes it as tall as the last
  // baseline stands below that, to the nearest pixel, so the last baseline drawn on a whole
  // pixel ends it (Figma desktop 126).
  const top = baseline - capHeights.of(first)
  for (const block of visible) {
    block.y -= top
  }
  return Math.round(lastBaseline - top)
}
