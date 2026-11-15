import { isEqual } from 'es-toolkit/predicate'

import type { CharacterStyleOverride, SceneNode, StyleRun } from '../types'

/** The run that styles `text[index]`, if one does. */
export function styleRunAt(runs: readonly StyleRun[], index: number): StyleRun | undefined {
  return runs.find((run) => index >= run.start && index < run.start + run.length)
}

/** The language `text[index]` is shaped in: its run's, or the text's own. */
export function textLanguageAt(
  node: Pick<SceneNode, 'styleRuns' | 'textLanguage'>,
  index: number
): string | null {
  const language = styleRunAt(node.styleRuns, index)?.style.textLanguage
  return language !== undefined ? language : node.textLanguage
}

/**
 * Adds `style` over `[start, start + length)` to runs built in text order, extending the last
 * run instead when it ends at `start` with an equal style. An empty style or range adds nothing,
 * since those characters keep the text's own style.
 */
export function appendStyleRun(
  runs: StyleRun[],
  start: number,
  length: number,
  style: CharacterStyleOverride
): void {
  if (length <= 0 || Object.keys(style).length === 0) return
  const previous = runs.at(-1)
  if (previous && previous.start + previous.length === start && isEqual(previous.style, style))
    previous.length += length
  else runs.push({ start, length, style })
}

/** A stretch of text in one style: a run's, or the text's own where `style` is null. */
export interface StyleRunPiece {
  start: number
  end: number
  style: CharacterStyleOverride | null
}

/**
 * The first `length` characters cut at their runs, in order and covering every character once:
 * a run's part that an earlier run already covers, or that lies past the text, is left out.
 */
export function styleRunPieces(runs: readonly StyleRun[], length: number): StyleRunPiece[] {
  const pieces: StyleRunPiece[] = []
  let at = 0
  for (const run of runs.toSorted((a, b) => a.start - b.start)) {
    const start = Math.min(length, Math.max(at, run.start))
    const end = Math.min(length, run.start + run.length)
    if (start > at) pieces.push({ start: at, end: start, style: null })
    if (end > start) pieces.push({ start, end, style: run.style })
    at = Math.max(start, end)
  }
  if (at < length) pieces.push({ start: at, end: length, style: null })
  return pieces
}

/** Each of the first `length` characters' overrides, merged from the runs over it in order. */
export function characterOverrides(
  runs: readonly StyleRun[],
  length: number
): CharacterStyleOverride[] {
  const styles = Array.from({ length }, (): CharacterStyleOverride => ({}))
  for (const run of runs) {
    const end = Math.min(length, run.start + run.length)
    for (let index = Math.max(0, run.start); index < end; index++) {
      styles[index] = { ...styles[index], ...run.style }
    }
  }
  return styles
}
