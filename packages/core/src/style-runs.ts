import type { CharacterStyleOverride, StyleRun, TextDecoration } from './scene-graph'

export function getStyleAt(runs: StyleRun[], index: number): CharacterStyleOverride {
  for (const run of runs) {
    if (index >= run.start && index < run.start + run.length) {
      return run.style
    }
  }
  return {}
}

function expandRuns(runs: StyleRun[], textLength: number): (CharacterStyleOverride | null)[] {
  const chars: (CharacterStyleOverride | null)[] = new Array(textLength).fill(null)
  for (const run of runs) {
    for (let i = run.start; i < run.start + run.length && i < textLength; i++) {
      chars[i] = { ...chars[i], ...run.style }
    }
  }
  return chars
}

export function applyStyleToRange(
  runs: StyleRun[],
  start: number,
  end: number,
  patch: CharacterStyleOverride,
  textLength: number
): StyleRun[] {
  const chars = expandRuns(runs, textLength)

  for (let i = start; i < end && i < textLength; i++) {
    chars[i] = { ...chars[i], ...patch }
  }

  return compactRuns(chars)
}

export function removeStyleFromRange(
  runs: StyleRun[],
  start: number,
  end: number,
  keys: (keyof CharacterStyleOverride)[],
  textLength: number
): StyleRun[] {
  const chars = expandRuns(runs, textLength)

  for (let i = start; i < end && i < textLength; i++) {
    if (chars[i]) {
      const copy = { ...chars[i]! }
      for (const k of keys) delete copy[k]
      chars[i] = Object.keys(copy).length > 0 ? copy : null
    }
  }

  return compactRuns(chars)
}

export function selectionHasStyle(
  runs: StyleRun[],
  start: number,
  end: number,
  key: keyof CharacterStyleOverride,
  value: unknown
): boolean {
  for (let i = start; i < end; i++) {
    const style = getStyleAt(runs, i)
    if (style[key] !== value) return false
  }
  return true
}

function stylesEqual(a: CharacterStyleOverride | null, b: CharacterStyleOverride | null): boolean {
  if (a === b) return true
  if (!a || !b) return a === b
  const aKeys = Object.keys(a) as (keyof CharacterStyleOverride)[]
  const bKeys = Object.keys(b) as (keyof CharacterStyleOverride)[]
  if (aKeys.length !== bKeys.length) return false
  for (const k of aKeys) {
    if (a[k] !== b[k]) return false
  }
  return true
}

function isEmptyStyle(style: CharacterStyleOverride | null): boolean {
  return !style || Object.keys(style).length === 0
}

function compactRuns(chars: (CharacterStyleOverride | null)[]): StyleRun[] {
  const result: StyleRun[] = []
  let i = 0
  while (i < chars.length) {
    if (isEmptyStyle(chars[i])) {
      i++
      continue
    }
    const start = i
    const style = chars[i]!
    while (i < chars.length && stylesEqual(chars[i], style)) i++
    result.push({ start, length: i - start, style: { ...style } })
  }
  return result
}

export function adjustRunsForInsert(
  runs: StyleRun[],
  pos: number,
  insertLength: number
): StyleRun[] {
  return runs.map((run) => {
    if (pos <= run.start) {
      return { ...run, start: run.start + insertLength }
    }
    if (pos > run.start && pos < run.start + run.length) {
      return { ...run, length: run.length + insertLength }
    }
    return run
  })
}

export function adjustRunsForDelete(
  runs: StyleRun[],
  start: number,
  deleteLength: number
): StyleRun[] {
  const end = start + deleteLength
  const result: StyleRun[] = []
  for (const run of runs) {
    const runEnd = run.start + run.length
    if (runEnd <= start) {
      result.push(run)
    } else if (run.start >= end) {
      result.push({ ...run, start: run.start - deleteLength })
    } else {
      const newStart = Math.max(run.start, start)
      const newEnd = Math.min(runEnd, end)
      const removed = newEnd - newStart
      const newLength = run.length - removed
      if (newLength > 0) {
        result.push({
          ...run,
          start: Math.min(run.start, start),
          length: newLength
        })
      }
    }
  }
  return result
}

export function toggleBoldInRange(
  runs: StyleRun[],
  start: number,
  end: number,
  nodeWeight: number,
  textLength: number
): { runs: StyleRun[]; newWeight: number } {
  const allBold = selectionAllBold(runs, start, end, nodeWeight)
  const targetWeight = allBold ? 400 : 700
  const newRuns = allBold
    ? removeStyleFromRange(runs, start, end, ['fontWeight'], textLength)
    : applyStyleToRange(runs, start, end, { fontWeight: 700 }, textLength)
  return { runs: newRuns, newWeight: targetWeight }
}

function selectionAllBold(
  runs: StyleRun[],
  start: number,
  end: number,
  nodeWeight: number
): boolean {
  for (let i = start; i < end; i++) {
    const style = getStyleAt(runs, i)
    const weight = style.fontWeight ?? nodeWeight
    if (weight < 700) return false
  }
  return true
}

export function toggleItalicInRange(
  runs: StyleRun[],
  start: number,
  end: number,
  nodeItalic: boolean,
  textLength: number
): { runs: StyleRun[]; newItalic: boolean } {
  const allItalic = selectionAllItalic(runs, start, end, nodeItalic)
  const newRuns = allItalic
    ? removeStyleFromRange(runs, start, end, ['italic'], textLength)
    : applyStyleToRange(runs, start, end, { italic: true }, textLength)
  return { runs: newRuns, newItalic: !allItalic }
}

function selectionAllItalic(
  runs: StyleRun[],
  start: number,
  end: number,
  nodeItalic: boolean
): boolean {
  for (let i = start; i < end; i++) {
    const style = getStyleAt(runs, i)
    if (!(style.italic ?? nodeItalic)) return false
  }
  return true
}

export function toggleDecorationInRange(
  runs: StyleRun[],
  start: number,
  end: number,
  deco: TextDecoration,
  nodeDeco: TextDecoration,
  textLength: number
): { runs: StyleRun[]; newDeco: TextDecoration } {
  const allHave = selectionAllHasDecoration(runs, start, end, deco, nodeDeco)
  const newRuns = allHave
    ? removeStyleFromRange(runs, start, end, ['textDecoration'], textLength)
    : applyStyleToRange(runs, start, end, { textDecoration: deco }, textLength)
  return { runs: newRuns, newDeco: allHave ? 'NONE' : deco }
}

function selectionAllHasDecoration(
  runs: StyleRun[],
  start: number,
  end: number,
  deco: TextDecoration,
  nodeDeco: TextDecoration
): boolean {
  for (let i = start; i < end; i++) {
    const style = getStyleAt(runs, i)
    if ((style.textDecoration ?? nodeDeco) !== deco) return false
  }
  return true
}
