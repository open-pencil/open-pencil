/**
 * Plain-language presets for a mode's condition, so a designer picks "System is in dark mode"
 * and the stylesheet still gets the exact CSS a developer expects. Presets only write the
 * condition string a mode already stores; anything they do not recognize stays custom CSS.
 */
import { isEqual } from 'es-toolkit/predicate'

import {
  featureConditionCSS,
  parseFeatureCondition,
  type FeatureCondition
} from '@open-pencil/dom-css/export'

export const CONDITION_KINDS = [
  'manual',
  'dark',
  'light',
  'contrast',
  'reduced-motion',
  'screen-narrower',
  'screen-wider',
  'container-narrower',
  'container-wider',
  'custom'
] as const
export type ConditionKind = (typeof CONDITION_KINDS)[number]

/** Presets that take a width in pixels. */
export const WIDTH_CONDITION_KINDS = [
  'screen-narrower',
  'screen-wider',
  'container-narrower',
  'container-wider'
] as const satisfies readonly ConditionKind[]
type WidthConditionKind = (typeof WIDTH_CONDITION_KINDS)[number]

export type ModeCondition =
  | { kind: Exclude<ConditionKind, WidthConditionKind | 'custom'> }
  | { kind: WidthConditionKind; width: number }
  | { kind: 'custom'; css: string }

/** The width a new width preset starts at. */
export const DEFAULT_CONDITION_WIDTH = 640

type FixedConditionKind = 'dark' | 'light' | 'contrast' | 'reduced-motion'

function keyword(feature: string, name: string): FeatureCondition {
  return { rule: 'media', feature, value: { type: 'keyword', name } }
}

const FIXED: Record<FixedConditionKind, FeatureCondition> = {
  dark: keyword('prefers-color-scheme', 'dark'),
  light: keyword('prefers-color-scheme', 'light'),
  contrast: keyword('prefers-contrast', 'more'),
  'reduced-motion': keyword('prefers-reduced-motion', 'reduce')
}

const WIDTH: Record<WidthConditionKind, Pick<FeatureCondition, 'rule' | 'feature'>> = {
  'screen-narrower': { rule: 'media', feature: 'max-width' },
  'screen-wider': { rule: 'media', feature: 'min-width' },
  'container-narrower': { rule: 'container', feature: 'max-width' },
  'container-wider': { rule: 'container', feature: 'min-width' }
}

function isWidthKind(kind: ConditionKind): kind is WidthConditionKind {
  return WIDTH_CONDITION_KINDS.some((candidate) => candidate === kind)
}

/** The preset a parsed condition is, if any: spacing, case and comments do not matter. */
function presetOf(query: FeatureCondition): ModeCondition | undefined {
  const fixed = Object.entries(FIXED).find(([, preset]) => isEqual(preset, query))
  if (fixed) return { kind: fixed[0] as FixedConditionKind }
  if (query.value.type !== 'dimension' || query.value.unit !== 'px') return undefined
  const kind = WIDTH_CONDITION_KINDS.find(
    (candidate) =>
      WIDTH[candidate].rule === query.rule && WIDTH[candidate].feature === query.feature
  )
  return kind && { kind, width: query.value.value }
}

/** Reads a stored condition back into the preset that writes it, or custom CSS. */
export function parseModeCondition(condition: string | undefined): ModeCondition {
  const css = condition?.trim() ?? ''
  if (!css) return { kind: 'manual' }
  const query = parseFeatureCondition(css)
  return (query && presetOf(query)) ?? { kind: 'custom', css }
}

/** The condition to store; `undefined` keeps the mode switched manually by its attribute. */
export function modeConditionCSS(condition: ModeCondition): string | undefined {
  switch (condition.kind) {
    case 'manual':
      return undefined
    case 'custom':
      return condition.css.trim() || undefined
    case 'dark':
    case 'light':
    case 'contrast':
    case 'reduced-motion':
      return featureConditionCSS(FIXED[condition.kind])
    default:
      return featureConditionCSS({
        ...WIDTH[condition.kind],
        value: { type: 'dimension', value: condition.width, unit: 'px' }
      })
  }
}

/** Switching presets keeps what still applies: a width carries over between width presets. */
export function changeConditionKind(current: ModeCondition, kind: ConditionKind): ModeCondition {
  if (kind === 'custom') return { kind, css: modeConditionCSS(current) ?? '' }
  if (isWidthKind(kind))
    return { kind, width: 'width' in current ? current.width : DEFAULT_CONDITION_WIDTH }
  return { kind }
}

/** Whether the browser turns the mode on by itself, rather than an attribute in the page. */
export function isAutomaticCondition(condition: ModeCondition): boolean {
  if (condition.kind === 'manual') return false
  if (condition.kind === 'custom') return condition.css.trimStart().startsWith('@')
  return true
}
