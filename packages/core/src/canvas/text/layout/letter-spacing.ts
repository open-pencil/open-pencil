import { sumBy } from 'es-toolkit'

import type { CharacterStyleOverride, StyleRun, TextLength } from '@open-pencil/scene-graph'
import { textLengthPixels } from '@open-pencil/scene-graph/text'

import type { StyledRange } from '#core/canvas/text/paragraph/runs'

// Skia's `Run::isCursiveScript`: runs in these scripts get no letter spacing.
const UNSPACED_SCRIPT =
  /[\p{Script=Arabic}\p{Script=Hanifi_Rohingya}\p{Script=Mandaic}\p{Script=Mongolian}\p{Script=Nko}\p{Script=Phags_Pa}\p{Script=Syriac}]/u
const SCRIPT_OF_NEIGHBOURS = /^[\p{Script=Common}\p{Script=Inherited}]$/u
const OWN_RUN = /^[\p{Nd}\n\v\f\r\u0085\u2028\u2029]$/u
const WHITESPACE = /\s/u

export interface LineSpacing {
  after: (index: number) => number
  least: number
  most: number
}

export const NO_LINE_SPACING: LineSpacing = {
  after: () => 0,
  least: 0,
  most: 0
}

export interface SpacedText {
  text: string
  letterSpacing: TextLength
  fontSize: number
  styleRuns: readonly StyledRange[]
  sourceLength: number
  sourceIndex: (index: number) => number
}

// Punctuation and marks join the letters' run; digits and text after a hard break get their own.
function unspacedRuns(text: string): Uint8Array {
  const unspaced = new Uint8Array(text.length)
  let inUnspacedRun = false
  let index = 0
  while (index < text.length) {
    const code = text.codePointAt(index) ?? 0
    const character = String.fromCodePoint(code)
    if (OWN_RUN.test(character)) {
      inUnspacedRun = false
    } else if (!SCRIPT_OF_NEIGHBOURS.test(character)) {
      inUnspacedRun = UNSPACED_SCRIPT.test(character)
    }
    const next = index + character.length
    unspaced.fill(inUnspacedRun ? 1 : 0, index, next)
    index = next
  }
  return unspaced
}

export function lineSpacing(spaced: SpacedText): LineSpacing {
  if (spaced.styleRuns.length === 0) {
    return evenSpacing(spaced.text, textLengthPixels(spaced.letterSpacing, spaced.fontSize))
  }
  const spacingOf = (style: CharacterStyleOverride | undefined) =>
    textLengthPixels(
      style?.letterSpacing ?? spaced.letterSpacing,
      style?.fontSize ?? spaced.fontSize
    )
  const runs = spaced.styleRuns
    .map(({ start, end, run }) => ({
      start,
      end: Math.min(spaced.sourceLength, end),
      spacing: spacingOf(run.style)
    }))
    .filter((run) => run.end > run.start)
  const base = spacingOf(undefined)
  const styledLength = sumBy(runs, (run) => run.end - run.start)
  const used = [
    ...(styledLength < spaced.sourceLength ? [base] : []),
    ...runs.map((run) => run.spacing)
  ]
  if (used.every((spacing) => spacing === 0)) {
    return NO_LINE_SPACING
  }
  const spacingAt = spacingBySourceIndex(spaced.sourceLength, base, runs)
  const styled = (index: number) => spacingAt[spaced.sourceIndex(index)] ?? base
  if (!UNSPACED_SCRIPT.test(spaced.text)) {
    return { after: styled, least: Math.min(...used), most: Math.max(...used) }
  }
  const unspaced = unspacedRuns(spaced.text)
  const after = (index: number) => (unspaced[index] === 1 ? 0 : styled(index))
  return { after, ...lineEndSpacings(spaced.text, after) }
}

interface RunSpacing {
  start: number
  end: number
  spacing: number
}

function spacingBySourceIndex(
  sourceLength: number,
  base: number,
  runs: readonly RunSpacing[]
): Float64Array {
  const spacingAt = new Float64Array(sourceLength).fill(base)
  for (const run of runs.toReversed()) {
    spacingAt.fill(run.spacing, run.start, run.end)
  }
  return spacingAt
}

function evenSpacing(text: string, spacing: number): LineSpacing {
  if (spacing === 0 || text.length === 0) {
    return NO_LINE_SPACING
  }
  const after = () => spacing
  if (!UNSPACED_SCRIPT.test(text)) {
    return { after, least: spacing, most: spacing }
  }
  const unspaced = unspacedRuns(text)
  const scripted = (index: number) => (unspaced[index] === 1 ? 0 : spacing)
  return { after: scripted, ...lineEndSpacings(text, scripted) }
}

function lineEndSpacings(
  text: string,
  after: (index: number) => number
): Pick<LineSpacing, 'least' | 'most'> {
  let least = 0
  let most = 0
  for (let index = 0; index < text.length; index++) {
    if (!WHITESPACE.test(text[index])) {
      const spacing = after(index)
      least = Math.min(least, spacing)
      most = Math.max(most, spacing)
    }
  }
  return { least, most }
}

export function spacesLetters(
  letterSpacing: TextLength,
  fontSize: number,
  styleRuns: readonly StyleRun[]
): boolean {
  return (
    textLengthPixels(letterSpacing, fontSize) !== 0 ||
    styleRuns.some(
      ({ style }) =>
        style.letterSpacing !== undefined &&
        textLengthPixels(style.letterSpacing, style.fontSize ?? fontSize) !== 0
    )
  )
}

export function isUnspaced(spacing: LineSpacing): boolean {
  return spacing.least === 0 && spacing.most === 0
}
