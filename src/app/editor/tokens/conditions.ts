/**
 * Plain-language presets for a mode's condition, so a designer picks "System is in dark mode"
 * and the stylesheet still gets the exact CSS a developer expects. Presets only write the
 * condition string a mode already stores; anything they do not recognize stays custom CSS.
 */

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

const FIXED: Record<'dark' | 'light' | 'contrast' | 'reduced-motion', string> = {
  dark: '@media (prefers-color-scheme: dark)',
  light: '@media (prefers-color-scheme: light)',
  contrast: '@media (prefers-contrast: more)',
  'reduced-motion': '@media (prefers-reduced-motion: reduce)'
}

const WIDTH: Record<WidthConditionKind, { rule: '@media' | '@container'; feature: string }> = {
  'screen-narrower': { rule: '@media', feature: 'max-width' },
  'screen-wider': { rule: '@media', feature: 'min-width' },
  'container-narrower': { rule: '@container', feature: 'max-width' },
  'container-wider': { rule: '@container', feature: 'min-width' }
}

function isWidthKind(kind: ConditionKind): kind is WidthConditionKind {
  return WIDTH_CONDITION_KINDS.some((candidate) => candidate === kind)
}

/** Spacing differences do not change a query: `@media(prefers-color-scheme:dark)` is dark. */
function normalize(css: string): string {
  return css
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\(\s*/g, ' (')
    .replace(/\s*\)/g, ')')
    .replace(/\s*:\s*/g, ': ')
    .trim()
}

const WIDTH_PATTERN = /^(@media|@container) \((max-width|min-width): (\d+(?:\.\d+)?)px\)$/

/** Reads a stored condition back into the preset that writes it, or custom CSS. */
export function parseModeCondition(condition: string | undefined): ModeCondition {
  const css = normalize(condition ?? '')
  if (!css) return { kind: 'manual' }
  for (const [kind, query] of Object.entries(FIXED))
    if (css === query) return { kind: kind as keyof typeof FIXED }
  const width = WIDTH_PATTERN.exec(css)
  if (width) {
    const [, rule, feature, value] = width
    const kind = WIDTH_CONDITION_KINDS.find(
      (candidate) => WIDTH[candidate].rule === rule && WIDTH[candidate].feature === feature
    )
    if (kind) return { kind, width: Number(value) }
  }
  return { kind: 'custom', css: condition?.trim() ?? '' }
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
      return FIXED[condition.kind]
    default: {
      const { rule, feature } = WIDTH[condition.kind]
      return `${rule} (${feature}: ${condition.width}px)`
    }
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
