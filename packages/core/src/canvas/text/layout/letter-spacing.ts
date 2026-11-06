import { sumBy } from 'es-toolkit'

import type { CharacterStyleOverride, StyleRun, TextLength } from '@open-pencil/scene-graph'
import { textLengthPixels } from '@open-pencil/scene-graph/text'

// Skia's `Run::isCursiveScript`: runs in these scripts get no letter spacing.
const UNSPACED_SCRIPT =
  /[\p{Script=Arabic}\p{Script=Hanifi_Rohingya}\p{Script=Mandaic}\p{Script=Mongolian}\p{Script=Nko}\p{Script=Phags_Pa}\p{Script=Syriac}]/u
const SCRIPT_OF_NEIGHBOURS = /^[\p{Script=Common}\p{Script=Inherited}]$/u
const OWN_RUN = /^[\p{Nd}\n]$/u
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
  styleRuns: readonly StyleRun[]
  sourceLength: number
  sourceIndex: (index: number) => number
}

function characterAt(text: string, index: number): string {
  const code = text.codePointAt(index) ?? 0
  return String.fromCodePoint(code)
}

// Shaping puts punctuation and marks in the run of the letters before them, digits in their own.
function inUnspacedRun(text: string, index: number): boolean {
  for (let at = index; at >= 0; at--) {
    const character = characterAt(text, at)
    if (OWN_RUN.test(character)) {
      return false
    }
    if (!SCRIPT_OF_NEIGHBOURS.test(character)) {
      return UNSPACED_SCRIPT.test(character)
    }
  }
  return false
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
    .map((run) => ({
      start: Math.max(0, run.start),
      end: Math.min(spaced.sourceLength, run.start + run.length),
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
  const styled = (index: number) => {
    const source = spaced.sourceIndex(index)
    return runs.find((run) => source >= run.start && source < run.end)?.spacing ?? base
  }
  if (!UNSPACED_SCRIPT.test(spaced.text)) {
    return { after: styled, least: Math.min(...used), most: Math.max(...used) }
  }
  const after = (index: number) => (inUnspacedRun(spaced.text, index) ? 0 : styled(index))
  return { after, ...lineEndSpacings(spaced.text, after) }
}

function evenSpacing(text: string, spacing: number): LineSpacing {
  if (spacing === 0 || text.length === 0) {
    return NO_LINE_SPACING
  }
  const after = () => spacing
  if (!UNSPACED_SCRIPT.test(text)) {
    return { after, least: spacing, most: spacing }
  }
  const scripted = (index: number) => (inUnspacedRun(text, index) ? 0 : spacing)
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
