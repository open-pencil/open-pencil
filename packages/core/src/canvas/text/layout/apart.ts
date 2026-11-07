import type { CanvasKit, LineMetrics, ShapedLine } from 'canvaskit-wasm'

import { allSame, type ShapedLines } from '#core/canvas/text/layout/lines'

export interface LineBand {
  shift: number
  top: number | null
  bottom: number | null
}

interface InkRows {
  top: number
  bottom: number
}

// Ink must clear the next band's by this much, or the clip cuts antialiasing.
const INK_GAP = 1

function lineInk(ck: CanvasKit, line: ShapedLine | undefined): InkRows | null {
  let top = Infinity
  let bottom = -Infinity
  for (const run of line?.runs ?? []) {
    const font = new ck.Font(run.typeface, run.size)
    try {
      const bounds = font.getGlyphBounds(run.glyphs)
      for (let index = 0; index < run.glyphs.length; index++) {
        const glyphTop = bounds[4 * index + 1]
        const glyphBottom = bounds[4 * index + 3]
        if (glyphBottom > glyphTop) {
          const baseline = run.positions[2 * index + 1]
          top = Math.min(top, baseline + glyphTop)
          bottom = Math.max(bottom, baseline + glyphBottom)
        }
      }
    } finally {
      font.delete()
    }
  }
  return top < bottom ? { top, bottom } : null
}

function joinInk(a: InkRows, b: InkRows): InkRows {
  return { top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom) }
}

export function lineBands(
  ck: CanvasKit,
  shifts: readonly number[],
  shaped: ShapedLines
): LineBand[] | null {
  const runs: Array<{ shift: number; ink: InkRows }> = []
  for (const [index, shift] of shifts.entries()) {
    const ink = lineInk(ck, shaped[index])
    const last = runs.at(-1)
    if (!ink) {
      continue
    }
    if (last && allSame([last.shift, shift])) {
      last.ink = joinInk(last.ink, ink)
    } else {
      runs.push({ shift, ink })
    }
  }
  const bands: LineBand[] = runs.map(({ shift }) => ({ shift, top: null, bottom: null }))
  for (let index = 1; index < runs.length; index++) {
    const above = runs[index - 1].ink
    const below = runs[index].ink
    if (below.top - above.bottom < INK_GAP) {
      return null
    }
    const edge = (above.bottom + below.top) / 2
    bands[index - 1].bottom = edge
    bands[index].top = edge
  }
  return bands
}

export function lineBoxBands(shifts: readonly number[], lines: readonly LineMetrics[]): LineBand[] {
  const bands: LineBand[] = []
  let lineTop = 0
  for (const [index, shift] of shifts.entries()) {
    const last = bands.at(-1)
    if (!last || !allSame([last.shift, shift])) {
      if (last) {
        last.bottom = lineTop
      }
      bands.push({ shift, top: last ? lineTop : null, bottom: null })
    }
    lineTop += lines[index]?.height ?? 0
  }
  return bands
}
