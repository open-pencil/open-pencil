import type { StyleRun } from '@open-pencil/scene-graph'

export interface StyledRange {
  start: number
  end: number
  run: StyleRun
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff
}

// Skia would replace each half of a split surrogate pair.
function codePointBoundary(text: string, index: number): number {
  const splitsPair =
    index > 0 &&
    index < text.length &&
    isLowSurrogate(text.charCodeAt(index)) &&
    isHighSurrogate(text.charCodeAt(index - 1))
  return splitsPair ? index + 1 : index
}

export function styledRanges(text: string, runs: readonly StyleRun[]): StyledRange[] {
  const ranges: StyledRange[] = []
  let position = 0
  for (const run of runs) {
    const start = Math.max(position, codePointBoundary(text, run.start))
    const end = codePointBoundary(text, run.start + run.length)
    if (end > start) {
      ranges.push({ start, end, run })
      position = end
    }
  }
  return ranges
}
