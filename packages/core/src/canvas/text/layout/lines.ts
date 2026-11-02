import type { CanvasKit, LineMetrics, Paragraph, ShapedLine } from 'canvaskit-wasm'

import type { Vector } from '@open-pencil/scene-graph/primitives'

/** A stretch of a paragraph's characters set at one line height, `null` for auto. */
export interface LineHeightRun {
  start: number
  end: number
  lineHeight: number | null
}

/** A block's line heights, and how to lay one of its lines out on its own. */
export interface TextLayoutBlockLines {
  /** Line heights by paragraph index, lead included. */
  heights: LineHeightRun[]
  /**
   * The paragraph's characters from `start` as a paragraph of their own, holding its `lines`
   * lines up to `end`, and ending in the ellipsis when `truncated`; absent when lines cannot
   * be drawn apart from the others.
   */
  build?: (start: number, end: number, lines: number, truncated: boolean) => Paragraph
}

/** What placing a text layout block's lines reads of it. */
interface LineBlock {
  paragraph: Paragraph
  /** The paragraph's line metrics as laid out, so placing reads them from the block. */
  metrics: LineMetrics[]
  lines?: TextLayoutBlockLines
  lead: number
  length: number
  inset: number
  spaceBefore: number
  y: number
}

/** Lines laid out as a paragraph of their own, and where its top left goes in its block. */
export interface LinePiece {
  paragraph: Paragraph
  x: number
  y: number
}

/** Where a block's lines go when they do not stack as its paragraph has them. */
export interface BlockPlacement {
  height: number
  /** How far each line stands below where the paragraph has it. */
  offsets: number[]
  boxes: LineBox[]
  /** Paragraphs of lines that move together, drawn in place of the block's when lines move apart. */
  pieces: LinePiece[] | null
}

/** A line as Figma sets it: its height, and how far its baseline stands below its top. */
export interface LineBox {
  height: number
  ascent: number
}

/** The difference below which two line positions count as the same. */
const LINE_EPSILON = 0.01
/**
 * Steps font metrics are measured in. Rects come in float32, whose error at a line far down a
 * text reaches the sixth digit, so lines in the same font would measure apart.
 */
const METRIC_STEPS = 1e4

function metric(value: number): number {
  return Math.round(value * METRIC_STEPS) / METRIC_STEPS
}

/**
 * A line's box as Figma sets it. The line is as tall as the tallest line height on it, auto
 * standing for a font's own height rounded to a whole pixel, and its baseline sits where its
 * tallest font, centred in that height, puts it. Fonts' heights are the shaped runs' own, so a
 * fallback font counts with its metrics. Returns `null` for a line with nothing to measure.
 */
/** The line a point `y` of the paragraph falls on, or `fallback` past them all. */
function lineAt(lines: readonly LineMetrics[], y: number, fallback: LineMetrics): LineMetrics {
  return lines.find((line) => y < line.baseline + line.descent) ?? fallback
}

export function figmaLineBox(
  ck: CanvasKit,
  paragraph: Paragraph,
  line: LineMetrics,
  runs: readonly LineHeightRun[],
  lines: readonly LineMetrics[] = paragraph.getLineMetrics()
): LineBox | null {
  // An empty line is as tall as the newline that makes it.
  const start = line.startIndex
  const end = Math.max(line.endIndex, start + 1)
  let height = 0
  let natural = 0
  let ascent = 0
  for (const run of runs) {
    const from = Math.max(start, run.start)
    const to = Math.min(end, run.end)
    if (to <= from) continue
    const rects = paragraph.getRectsForRange(
      from,
      to,
      ck.RectHeightStyle.Tight,
      ck.RectWidthStyle.Tight
    )
    for (const { rect } of rects) {
      const runNatural = metric(rect[3] - rect[1])
      // A first-line indent is a placeholder with no height.
      if (runNatural <= 0) continue
      height = Math.max(height, Math.round(run.lineHeight ?? runNatural))
      if (runNatural > natural) {
        natural = runNatural
        // The newline that makes an empty line stands on the line above, so its box is
        // measured from the baseline of the line it stands on.
        ascent = metric(lineAt(lines, (rect[1] + rect[3]) / 2, line).baseline - rect[1])
      }
    }
  }
  if (natural === 0) return null
  return { height, ascent: (height - natural) / 2 + ascent }
}

/** Whether all `values` are the same, to within the precision lines are placed with. */
export function allSame(values: readonly number[]): boolean {
  const first = values.at(0)
  return first === undefined || values.every((value) => Math.abs(value - first) < LINE_EPSILON)
}

/** Each block's lines as Figma sets them, or `null` when one cannot be measured. */
function lineBoxes(
  ck: CanvasKit,
  blocks: readonly LineBlock[],
  metrics: readonly LineMetrics[][]
): LineBox[][] | null {
  const boxes: LineBox[][] = []
  for (const [index, block] of blocks.entries()) {
    const heights = block.lines?.heights
    if (!heights) return null
    const blockBoxes: LineBox[] = []
    for (const line of metrics[index]) {
      const box = figmaLineBox(ck, block.paragraph, line, heights, metrics[index])
      if (!box) return null
      blockBoxes.push(box)
    }
    boxes.push(blockBoxes)
  }
  return boxes
}

/**
 * A paragraph's shaped lines by line number. Shaping leaves empty lines out, so each shaped
 * line goes to the line whose baseline is nearest its own.
 */
export function shapedLinesByLine(paragraph: Paragraph): Array<ShapedLine | undefined> {
  const lines = paragraph.getLineMetrics()
  const byLine: Array<ShapedLine | undefined> = Array.from({ length: lines.length })
  for (const shaped of paragraph.getShapedLines()) {
    let nearest = 0
    for (const [index, line] of lines.entries()) {
      const distance = Math.abs(line.baseline - shaped.baseline)
      if (distance < Math.abs(lines[nearest].baseline - shaped.baseline)) nearest = index
    }
    byLine[nearest] = shaped
  }
  return byLine
}

/** Where a shaped line's first glyph stands, if it has one. */
function firstGlyph(line: ShapedLine | undefined): [number, number] | null {
  const positions = line?.runs.find((run) => run.glyphs.length > 0)?.positions
  return positions ? [positions[0], positions[1]] : null
}

/** How far glyphs a piece draws must move to land where the block's lines have them. */
function pieceShift(
  shaped: ReadonlyArray<ShapedLine | undefined>,
  own: ReadonlyArray<ShapedLine | undefined>
): (Vector & { agrees: number }) | null {
  let shift: Vector | null = null
  // Paragraphs snap each line to whole-pixel baselines their own way, so lines of one piece
  // may need different shifts; the piece holds the lines that agree with its first.
  for (const [index, line] of own.entries()) {
    const glyph = firstGlyph(shaped[index])
    const ownGlyph = firstGlyph(line)
    if (!glyph || !ownGlyph) continue
    const x = glyph[0] - ownGlyph[0]
    const y = glyph[1] - ownGlyph[1]
    if (!shift) shift = { x, y }
    else if (!allSame([shift.x, x]) || !allSame([shift.y, y])) return { ...shift, agrees: index }
  }
  return shift && { ...shift, agrees: own.length }
}

/**
 * The block's lines as paragraphs of their own, one for each run of lines that move by the
 * same offset, or one per line when not `grouped`, placed so their glyphs land where the
 * block's paragraph has them, moved by that offset. `null` when lines cannot be laid out
 * apart from the others.
 */
function buildPieces(
  block: LineBlock,
  width: number,
  offsets: readonly number[],
  grouped = true
): LinePiece[] | null {
  const build = block.lines?.build
  if (!build) return null
  const lines = block.paragraph.getLineMetrics()
  const shaped = shapedLinesByLine(block.paragraph)
  const truncated = block.paragraph.didExceedMaxLines()
  const textEnd = block.lead + block.length
  const pieces: LinePiece[] = []
  let from = 0
  while (from < lines.length) {
    let to = from + 1
    if (grouped) while (to < lines.length && allSame([offsets[from], offsets[to]])) to++
    const start = lines[from].startIndex
    const end = to === lines.length ? textEnd : lines[to - 1].endIndex
    // Empty lines draw nothing.
    if (end <= start) {
      from = to
      continue
    }
    const count = to - from
    const paragraph = build(start, end, count, to === lines.length && truncated)
    paragraph.layout(Math.max(1, width - block.inset))
    const own = paragraph.getLineMetrics().length === count ? shapedLinesByLine(paragraph) : null
    const shift = own && pieceShift(shaped.slice(from, to), own)
    if (!shift || shift.agrees < count) {
      paragraph.delete()
      for (const piece of pieces) piece.paragraph.delete()
      // Lines that lay out or snap apart are drawn one by one.
      return grouped ? buildPieces(block, width, offsets, false) : null
    }
    pieces.push({ paragraph, x: shift.x, y: shift.y + offsets[from] })
    from = to
  }
  return pieces
}

/** Where `placeLines` puts each block, and the text's height. */
export interface PlacedLines<Block> {
  blocks: Map<Block, BlockPlacement & { y: number }>
  height: number
}

/**
 * Lines of laid-out blocks placed as Figma places them when they differ in height: each
 * line is as tall as its tallest line height, and each baseline stands that far, plus the
 * paragraph's spacing, below the one before, where a paragraph would stack the lines' boxes.
 * `null` keeps the paragraphs' placement: for lines alike, where it is the same, and for
 * lines that cannot be measured or drawn apart.
 */
export function placeLines<Block extends LineBlock>(
  ck: CanvasKit,
  blocks: readonly Block[],
  width: number
): PlacedLines<Block> | null {
  const metrics = blocks.map((block) => block.metrics)
  // A single line has none to be spaced from.
  if (metrics.flat().length < 2) return null
  const boxes = lineBoxes(ck, blocks, metrics)
  if (!boxes) return null
  const all = boxes.flat()
  if (allSame(all.map((box) => box.height)) && allSame(all.map((box) => box.ascent))) return null

  // Distances from the first baseline add up whole-pixel line heights, so they stay exact.
  const first = all[0]
  const last = all[all.length - 1]
  let below = 0
  const baselines = blocks.map((block, index) =>
    boxes[index].map((box, line) => {
      if (index > 0 || line > 0) below += box.height + (line === 0 ? block.spaceBefore : 0)
      return first.ascent + below
    })
  )
  const placed = new Map<Block, BlockPlacement & { y: number }>()
  for (const [index, block] of blocks.entries()) {
    const lines = metrics[index]
    const blockBoxes = boxes[index]
    const blockBaselines = baselines[index]
    const end = blockBoxes.length - 1
    const y = blockBaselines[0] - lines[0].baseline
    const offsets = lines.map((line, lineIndex) => blockBaselines[lineIndex] - y - line.baseline)
    const apart = !allSame(offsets)
    const pieces = apart ? buildPieces(block, width, offsets) : null
    placed.set(block, {
      y,
      height: blockBaselines[end] - blockBoxes[end].ascent + blockBoxes[end].height - y,
      offsets,
      boxes: blockBoxes,
      pieces
    })
    // Lines that cannot be drawn apart keep the paragraph's placement, and so does the text.
    if (apart && !pieces) {
      for (const placement of placed.values()) {
        for (const piece of placement.pieces ?? []) piece.paragraph.delete()
      }
      return null
    }
  }
  return { blocks: placed, height: first.ascent - last.ascent + below + last.height }
}
