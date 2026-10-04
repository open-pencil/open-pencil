import type { LintFix, LintFixRequest } from '@open-pencil/core/lint'
import { locale, type useDesignCheckMessages } from '@open-pencil/vue'

import type { DesignIssue } from './issues'

export type DesignCheckMessages = ReturnType<typeof useDesignCheckMessages>['value']
type Messages = DesignCheckMessages

type StringKey = {
  [Key in keyof Messages]: Messages[Key] extends string ? Key : never
}[keyof Messages]

interface RuleCopy {
  title: StringKey
  help: StringKey
}

const RULE_COPY: Partial<Record<string, RuleCopy>> = {
  'color-contrast': { title: 'ruleColorContrast', help: 'ruleColorContrastHelp' },
  'touch-target-size': { title: 'ruleTouchTargetSize', help: 'ruleTouchTargetSizeHelp' },
  'min-text-size': { title: 'ruleMinTextSize', help: 'ruleMinTextSizeHelp' },
  'consistent-spacing': { title: 'ruleConsistentSpacing', help: 'ruleConsistentSpacingHelp' },
  'consistent-radius': { title: 'ruleConsistentRadius', help: 'ruleConsistentRadiusHelp' },
  'no-hardcoded-colors': { title: 'ruleNoHardcodedColors', help: 'ruleNoHardcodedColorsHelp' },
  'no-default-names': { title: 'ruleNoDefaultNames', help: 'ruleNoDefaultNamesHelp' },
  'prefer-auto-layout': { title: 'rulePreferAutoLayout', help: 'rulePreferAutoLayoutHelp' },
  'text-style-required': { title: 'ruleTextStyleRequired', help: 'ruleTextStyleRequiredHelp' },
  'no-hidden-layers': { title: 'ruleNoHiddenLayers', help: 'ruleNoHiddenLayersHelp' },
  'no-deeply-nested': { title: 'ruleNoDeeplyNested', help: 'ruleNoDeeplyNestedHelp' },
  'no-empty-frames': { title: 'ruleNoEmptyFrames', help: 'ruleNoEmptyFramesHelp' },
  'pixel-perfect': { title: 'rulePixelPerfect', help: 'rulePixelPerfectHelp' },
  'no-groups': { title: 'ruleNoGroups', help: 'ruleNoGroupsHelp' },
  'effect-style-required': {
    title: 'ruleEffectStyleRequired',
    help: 'ruleEffectStyleRequiredHelp'
  },
  'no-mixed-styles': { title: 'ruleNoMixedStyles', help: 'ruleNoMixedStylesHelp' },
  'no-detached-instances': {
    title: 'ruleNoDetachedInstances',
    help: 'ruleNoDetachedInstancesHelp'
  }
}

const SPACING_DETAIL = {
  itemSpacing: 'detailSpacingGap',
  paddingTop: 'detailSpacingTop',
  paddingRight: 'detailSpacingRight',
  paddingBottom: 'detailSpacingBottom',
  paddingLeft: 'detailSpacingLeft'
} as const

/** Figma's geometry field labels, which stay untranslated across its locales. */
const GEOMETRY_LABELS: Record<string, string> = { x: 'X', y: 'Y', width: 'W', height: 'H' }

const numberFormats = new Map<string, Intl.NumberFormat>()

/** Numbers follow the app's language, not the browser's, like the rest of the panel. */
function formatNumber(value: number): string {
  const language = locale.get()
  let format = numberFormats.get(language)
  if (!format) {
    format = new Intl.NumberFormat(language, { maximumFractionDigits: 2 })
    numberFormats.set(language, format)
  }
  return format.format(value)
}

function numberAt(issue: DesignIssue, key: string): number | undefined {
  const value = issue.data?.[key]
  return typeof value === 'number' ? value : undefined
}

function stringAt(issue: DesignIssue, key: string): string | undefined {
  const value = issue.data?.[key]
  return typeof value === 'string' ? value : undefined
}

/**
 * The last two segments of a grouped variable name: `Colors/Blue/600` reads as `Blue/600`,
 * which is enough next to its swatch in a narrow row.
 */
export function shortVariableName(name: string): string {
  const segments = name.split('/')
  return segments.length > 2 ? segments.slice(-2).join('/') : name
}

/** Rules without copy, such as custom rules, fall back to their id and raw message. */
export function ruleTitle(ruleId: string, messages: Messages): string {
  const copy = RULE_COPY[ruleId]
  return copy ? messages[copy.title] : ruleId
}

export function ruleHelp(ruleId: string, messages: Messages): string | null {
  const copy = RULE_COPY[ruleId]
  return copy ? messages[copy.help] : null
}

/** The value that makes this finding different from others of the same rule. */
// One case per rule keeps each presentation next to its data contract.
// eslint-disable-next-line complexity
export function issueDetail(issue: DesignIssue, messages: Messages): string | null {
  const px = (value: number | undefined) => (value === undefined ? '' : `${formatNumber(value)} px`)
  switch (issue.ruleId) {
    case 'color-contrast': {
      const ratio = numberAt(issue, 'ratio')
      return ratio === undefined ? null : `${formatNumber(ratio)}:1`
    }
    case 'touch-target-size': {
      const width = numberAt(issue, 'width')
      const height = numberAt(issue, 'height')
      if (width === undefined || height === undefined) return null
      return `${formatNumber(width)} × ${formatNumber(height)}`
    }
    case 'min-text-size':
      return px(numberAt(issue, 'fontSize')) || null
    case 'consistent-radius':
      return px(numberAt(issue, 'radius')) || null
    case 'consistent-spacing': {
      const property = stringAt(issue, 'property')
      const value = numberAt(issue, 'value')
      const key =
        property && property in SPACING_DETAIL
          ? SPACING_DETAIL[property as keyof typeof SPACING_DETAIL]
          : null
      if (!key || value === undefined) return null
      return messages[key]({ value: formatNumber(value) })
    }
    case 'no-hardcoded-colors': {
      const name = stringAt(issue, 'variableName')
      if (!name) return null
      const variable = shortVariableName(name)
      return stringAt(issue, 'paint') === 'stroke'
        ? messages.detailStrokeColor({ variable })
        : variable
    }
    case 'prefer-auto-layout': {
      const children = numberAt(issue, 'children')
      return children === undefined ? null : messages.detailChildren({ children })
    }
    case 'no-deeply-nested': {
      const depth = numberAt(issue, 'depth')
      return depth === undefined ? null : messages.detailDepth({ depth })
    }
    case 'pixel-perfect': {
      const parts = Object.entries(GEOMETRY_LABELS).flatMap(([key, label]) => {
        const value = numberAt(issue, key)
        return value === undefined ? [] : [`${label} ${formatNumber(value)}`]
      })
      return parts.length > 0 ? parts.join(', ') : null
    }
    default:
      return RULE_COPY[issue.ruleId] ? null : issue.message
  }
}

export type IssueSwatch =
  | { kind: 'color'; color: string }
  | { kind: 'contrast'; foreground: string; background: string }

/** A preview of the colors a finding is about: the paint, or text on its background. */
export function issueSwatch(issue: DesignIssue): IssueSwatch | null {
  if (issue.ruleId === 'no-hardcoded-colors') {
    const color = stringAt(issue, 'color')
    return color ? { kind: 'color', color } : null
  }
  if (issue.ruleId === 'color-contrast') {
    const foreground = stringAt(issue, 'foreground')
    const background = stringAt(issue, 'background')
    return foreground && background ? { kind: 'contrast', foreground, background } : null
  }
  return null
}

/** Full radius, the pill shape Figma writes for a corner radius larger than the layer. */
const FULL_RADIUS = 9999

/** The one-step fix a row offers: the rule's safe fix, or else its first suggestion. */
export interface IssueAction {
  request: LintFixRequest
  label: string
  kind: LintFix['kind']
}

function fixLabel(fix: LintFix, messages: Messages): string {
  if (fix.kind === 'bind-variable') {
    return messages.bindVariable({ variable: fix.variableName })
  }
  const changes = Object.entries(fix.changes)
  // Geometry changes only come from rounding to whole pixels.
  if (changes.length !== 1 || changes.some(([property]) => property in GEOMETRY_LABELS)) {
    return messages.fixRoundPixels
  }
  const [property, value] = changes[0]
  if (property === 'cornerRadius' && value === FULL_RADIUS) return messages.fixFullRadius
  return messages.fixUseValue({ value: `${formatNumber(value)} px` })
}

export function issueAction(issue: DesignIssue, messages: Messages): IssueAction | null {
  const fix = issue.fix ?? issue.suggestions?.[0]
  if (!fix) return null
  return { request: { nodeId: issue.nodeId, fix }, label: fixLabel(fix, messages), kind: fix.kind }
}
