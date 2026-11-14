import { compact } from 'es-toolkit'

import type { CanvasKit, ShapedLine } from '@open-pencil/canvaskit'

import {
  joinerGlyphEnd,
  toUtf8,
  utf8JoinerAt,
  type TextLayoutBlock
} from '#core/canvas/text/layout/block'
import { shapedLinesByLine } from '#core/canvas/text/layout/lines'
import type { LineShift } from '#core/canvas/text/layout/positions'

type GlyphRun = ShapedLine['runs'][number]

function keptGlyphs(run: GlyphRun, kept: readonly number[], endX: number): GlyphRun {
  const count = run.glyphs.length
  const end = kept.length
  const positions = new Float32Array(2 * (end + 1))
  for (const [order, index] of kept.entries()) {
    positions[2 * order] = run.positions[2 * index]
    positions[2 * order + 1] = run.positions[2 * index + 1]
  }
  positions[2 * end] = endX
  positions[2 * end + 1] = run.positions[2 * count + 1]
  return {
    ...run,
    glyphs: Uint16Array.from(kept, (index) => run.glyphs[index]),
    positions,
    offsets: Uint32Array.from([...kept, count], (index) => run.offsets[index])
  }
}

// Skia leaves the spacing of a glyph out of its run when it shapes the joiner after it apart.
function drawnRun(ck: CanvasKit, block: TextLayoutBlock, run: GlyphRun): GlyphRun | null {
  const count = run.glyphs.length
  const kept: number[] = []
  let following = utf8JoinerAt(block, run.offsets[count])
  for (let index = 0; index < count; index++) {
    const joiner = utf8JoinerAt(block, run.offsets[index])
    if (joiner) {
      following ??= joiner
    } else {
      kept.push(index)
    }
  }
  const glyphEnd = following && joinerGlyphEnd(ck, block, following)
  if (kept.length === 0) {
    return null
  }
  if (kept.length === count && glyphEnd === undefined) {
    return run
  }
  const lastKept = kept[kept.length - 1]
  const endX = glyphEnd ?? run.positions[2 * (lastKept + 1)]
  return keptGlyphs(run, kept, endX)
}

function drawnRuns(ck: CanvasKit, block: TextLayoutBlock, line: ShapedLine): GlyphRun[] {
  if (block.joiners.count === 0) {
    return line.runs
  }
  return compact(line.runs.map((run) => drawnRun(ck, block, run)))
}

/**
 * Shaped lines of the text in whole-text coordinates, one per line; run offsets are UTF-8
 * byte offsets into the whole text, as CanvasKit gives them. An empty line, which shaping
 * leaves out, has no runs and starts where the line before it ends.
 */
export function textShapedLines(
  ck: CanvasKit,
  visible: readonly TextLayoutBlock[],
  lineOffset: (block: TextLayoutBlock, index: number) => number,
  lineShift: LineShift
): ShapedLine[] {
  const shaped: ShapedLine[] = []
  for (const block of visible) {
    const metrics = block.paragraph.getLineMetrics()
    for (const [lineIndex, line] of shapedLinesByLine(block.paragraph).entries()) {
      const y = block.y + lineOffset(block, lineIndex)
      const x = block.x + lineShift(block, lineIndex)
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
          : drawnRuns(ck, block, line).map((run) => ({
              ...run,
              positions: run.positions.map((value, index) => value + (index % 2 === 0 ? x : y)),
              offsets: run.offsets.map((offset) => toUtf8(block, offset))
            }))
      })
    }
  }
  return shaped
}
