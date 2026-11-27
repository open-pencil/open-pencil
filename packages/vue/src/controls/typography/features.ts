import type { FontFeatureInfo } from '@open-pencil/core/text'
import type { FontFeature } from '@open-pencil/scene-graph'

/** Features a font applies unless they are turned off; every other feature is off until on. */
const DEFAULT_ON = new Set(['LIGA', 'CLIG', 'CALT', 'KERN', 'RLIG', 'CCMP', 'LOCL', 'MARK', 'MKMK'])

/**
 * Features a font applies by itself where they belong, such as a script's joining forms and
 * marks, or other features use, as fractions use numerators and denominators: none is a choice.
 */
const AUTOMATIC = new Set([
  'AALT',
  'ABVF',
  'ABVM',
  'ABVS',
  'AKHN',
  'BLWF',
  'BLWM',
  'BLWS',
  'CCMP',
  'CJCT',
  'CURS',
  'DIST',
  'DNOM',
  'FINA',
  'FIN2',
  'FIN3',
  'HALF',
  'HALN',
  'INIT',
  'ISOL',
  'LJMO',
  'LOCL',
  'LTRA',
  'LTRM',
  'MARK',
  'MED2',
  'MEDI',
  'MKMK',
  'NUKT',
  'NUMR',
  'PREF',
  'PRES',
  'PSTF',
  'PSTS',
  'RCLT',
  'RKRF',
  'RLIG',
  'RPHF',
  'RTLA',
  'RTLM',
  'RVRN',
  'SIZE',
  'STCH',
  'TJMO',
  'VATU',
  'VJMO'
])

/** Features the typography panel shows on its own: ligatures, alternates, kerning, small caps. */
const SHOWN_ELSEWHERE = new Set(['LIGA', 'CALT', 'KERN', 'SMCP', 'C2SC'])

/** Whether `tag` is on for text with `features`, as the font applies it unless told. */
export function featureEnabled(features: readonly FontFeature[], tag: string): boolean {
  return features.find((feature) => feature.tag === tag)?.enabled ?? DEFAULT_ON.has(tag)
}

/** The features `changes` turns on, off, or back to the font's default, with `null`. */
export function withFeatures(
  features: readonly FontFeature[],
  changes: Readonly<Record<string, boolean | null>>
): FontFeature[] {
  const kept = features.filter((feature) => !(feature.tag in changes))
  const set = Object.entries(changes).flatMap(([tag, enabled]) =>
    enabled === null ? [] : [{ tag, enabled }]
  )
  return [...kept, ...set]
}

/** How a text's figures are spaced and shaped: the font's default, or a pair of features. */
export type NumberStyle = 'DEFAULT' | 'PNUM_LNUM' | 'TNUM_LNUM' | 'PNUM_ONUM' | 'TNUM_ONUM'

/** Where a text's figures sit: on the baseline, or raised or lowered as small figures. */
export type NumberPosition = 'NORMAL' | 'SUPS' | 'SUBS'

/** A feature the panel turns on and off by itself, with the font's name for it, if it has one. */
export interface FeatureToggle {
  tag: string
  name: string | null
}

/** The features a font offers, grouped as Figma's type details group them. */
export interface FontFeatureSections {
  smallCaps: boolean
  forcedSmallCaps: boolean
  letterCase: FeatureToggle[]
  numberStyles: NumberStyle[]
  numberPositions: NumberPosition[]
  numbers: FeatureToggle[]
  letterforms: FeatureToggle[]
  stylisticSets: FeatureToggle[]
  characterVariants: FeatureToggle[]
  other: FeatureToggle[]
}

const LETTER_CASE = ['CASE', 'CPSP']
const NUMBERS = ['FRAC', 'ZERO']
const LETTERFORMS = ['DLIG', 'ORDN', 'SALT', 'SWSH', 'TITL', 'HLIG']
const NUMBER_FEATURES = new Set(['PNUM', 'TNUM', 'LNUM', 'ONUM', 'SUPS', 'SUBS'])
const STYLISTIC_SET = /^SS\d\d$/
const CHARACTER_VARIANT = /^CV\d\d$/

/** The feature tags a number style turns on, and so the ones it needs the font to have. */
export const NUMBER_STYLE_FEATURES: Record<NumberStyle, readonly string[]> = {
  DEFAULT: [],
  PNUM_LNUM: ['PNUM', 'LNUM'],
  TNUM_LNUM: ['TNUM', 'LNUM'],
  PNUM_ONUM: ['PNUM', 'ONUM'],
  TNUM_ONUM: ['TNUM', 'ONUM']
}

/**
 * The features a font offers, by section, as the panel lists them: those it applies by itself are
 * left out, and lining figures count as the default where the font has no `lnum` of its own.
 */
export function fontFeatureSections(available: readonly FontFeatureInfo[]): FontFeatureSections {
  const byTag = new Map(available.map((feature) => [feature.tag.toUpperCase(), feature.name]))
  const has = (tag: string) => byTag.has(tag)
  const toggles = (tags: readonly string[]) =>
    tags.filter(has).map((tag) => ({ tag, name: byTag.get(tag) ?? null }))
  const matching = (pattern: RegExp) =>
    toggles([...byTag.keys()].filter((tag) => pattern.test(tag)))
  const listed = new Set([...LETTER_CASE, ...NUMBERS, ...LETTERFORMS])
  const numberStyles = (Object.keys(NUMBER_STYLE_FEATURES) as NumberStyle[]).filter(
    (style) =>
      style === 'DEFAULT' ||
      // Lining figures are the default of a font without `lnum`.
      NUMBER_STYLE_FEATURES[style].every((tag) => has(tag) || tag === 'LNUM')
  )
  return {
    smallCaps: has('SMCP'),
    forcedSmallCaps: has('SMCP') && has('C2SC'),
    letterCase: toggles(LETTER_CASE),
    numberStyles: numberStyles.length > 1 ? numberStyles : [],
    numberPositions:
      has('SUPS') || has('SUBS')
        ? ['NORMAL', ...toggles(['SUPS', 'SUBS']).map(({ tag }) => tag as NumberPosition)]
        : [],
    numbers: toggles(NUMBERS),
    letterforms: toggles(LETTERFORMS),
    stylisticSets: matching(STYLISTIC_SET),
    characterVariants: matching(CHARACTER_VARIANT),
    other: [...byTag.keys()]
      .filter(
        (tag) =>
          !AUTOMATIC.has(tag) &&
          !SHOWN_ELSEWHERE.has(tag) &&
          !NUMBER_FEATURES.has(tag) &&
          !listed.has(tag) &&
          !STYLISTIC_SET.test(tag) &&
          !CHARACTER_VARIANT.test(tag)
      )
      .map((tag) => ({ tag, name: byTag.get(tag) ?? null }))
  }
}

/** The number style features `features` set, or the font's default when they set none. */
export function numberStyleOf(features: readonly FontFeature[]): NumberStyle {
  const first = (tags: readonly string[]) => tags.find((tag) => featureEnabled(features, tag))
  const spacing = first(['TNUM', 'PNUM'])
  const figures = first(['ONUM', 'LNUM'])
  if (!spacing && !figures) return 'DEFAULT'
  return `${spacing ?? 'PNUM'}_${figures ?? 'LNUM'}` as NumberStyle
}

/** Where `features` put figures. */
export function numberPositionOf(features: readonly FontFeature[]): NumberPosition {
  if (featureEnabled(features, 'SUPS')) return 'SUPS'
  return featureEnabled(features, 'SUBS') ? 'SUBS' : 'NORMAL'
}

/** The feature changes that give text `style`, turning the other number styles' features off. */
export function numberStyleChanges(style: NumberStyle): Record<string, boolean | null> {
  const on = new Set(NUMBER_STYLE_FEATURES[style])
  return Object.fromEntries(
    ['PNUM', 'TNUM', 'LNUM', 'ONUM'].map((tag) => [tag, on.has(tag) || null])
  )
}

/** The feature changes that put figures at `position`. */
export function numberPositionChanges(position: NumberPosition): Record<string, boolean | null> {
  return { SUPS: position === 'SUPS' || null, SUBS: position === 'SUBS' || null }
}
