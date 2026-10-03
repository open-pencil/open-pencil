import type { TokenUnit, Variable, VariableScope } from '../types'

/** `rem` tokens are stored in canvas pixels and written against this root font size. */
export const ROOT_FONT_SIZE_PX = 16

/**
 * Tailwind v4 theme namespaces, used as the default taxonomy so one custom property serves
 * both `var(--color-primary)` and `bg-primary`. A convention for derived names, not a rule.
 */
export const TOKEN_NAMESPACES = [
  'color',
  'spacing',
  'radius',
  'text',
  'leading',
  'tracking',
  'font',
  'font-weight',
  'opacity',
  'blur'
] as const
export type TokenNamespace = (typeof TOKEN_NAMESPACES)[number]

const SCOPE_NAMESPACES: Partial<Record<VariableScope, TokenNamespace>> = {
  CORNER_RADIUS: 'radius',
  GAP: 'spacing',
  WIDTH_HEIGHT: 'spacing',
  FONT_SIZE: 'text',
  LINE_HEIGHT: 'leading',
  LETTER_SPACING: 'tracking',
  FONT_FAMILY: 'font',
  FONT_STYLE: 'font-weight',
  OPACITY: 'opacity',
  EFFECT_FLOAT: 'blur'
}

/** Leading name segments that already say the namespace, so `Color/primary` is not `--color-color-primary`. */
const NAMESPACE_WORDS: Record<string, TokenNamespace> = {
  color: 'color',
  colors: 'color',
  colour: 'color',
  colours: 'color',
  spacing: 'spacing',
  space: 'spacing',
  radius: 'radius',
  radii: 'radius',
  rounded: 'radius',
  corner: 'radius',
  corners: 'radius',
  text: 'text',
  'font-size': 'text',
  leading: 'leading',
  'line-height': 'leading',
  tracking: 'tracking',
  'letter-spacing': 'tracking',
  font: 'font',
  fonts: 'font',
  'font-family': 'font',
  'font-weight': 'font-weight',
  weight: 'font-weight',
  opacity: 'opacity',
  blur: 'blur'
}

const UNITLESS_NAMESPACES = new Set<TokenNamespace>(['font-weight', 'opacity'])
const CUSTOM_PROPERTY = /^--([^\s:;{}()]+)$/
const VAR_REFERENCE = /^var\(\s*--([^\s:;{}(),]+)\s*(?:,[^)]*)?\)$/

function slug(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replaceAll(/[\s/._]+/g, '-')
    .replaceAll(/[^\p{L}\p{N}-]/gu, '')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-|-$/g, '')
}

function scopeNamespace(variable: Variable): TokenNamespace | undefined {
  const namespaces = new Set((variable.scopes ?? []).map((scope) => SCOPE_NAMESPACES[scope]))
  const [only] = namespaces
  return namespaces.size === 1 ? only : undefined
}

/** The namespace a token belongs to, from its type, its scopes, then its leading name segment. */
export function variableNamespace(variable: Variable): TokenNamespace | undefined {
  if (variable.type === 'COLOR') return 'color'
  const fromScope = scopeNamespace(variable)
  if (fromScope) return fromScope
  return NAMESPACE_WORDS[slug(variable.name.split('/')[0] ?? '')]
}

/** A custom property name from a `var(--x)` or `--x` code snippet; anything else is not one. */
export function parseCSSName(snippet: string | undefined): string | undefined {
  const text = snippet?.trim() ?? ''
  return (VAR_REFERENCE.exec(text) ?? CUSTOM_PROPERTY.exec(text))?.[1]
}

/** `Gray/50` as COLOR is `color-gray-50`; `Space/small` scoped to gaps is `spacing-small`. */
export function deriveCSSName(variable: Variable): string {
  const namespace = variableNamespace(variable)
  const segments = variable.name.split('/').map(slug).filter(Boolean)
  if (segments.length > 1 && namespace && NAMESPACE_WORDS[segments[0]] === namespace) {
    segments.shift()
  }
  const body = segments.join('-') || 'token'
  if (!namespace || body === namespace || body.startsWith(`${namespace}-`)) return body
  return `${namespace}-${body}`
}

/**
 * Document-wide custom property names, without `--`. The first token to claim an explicit name
 * keeps it; later claimants, as Figma files do contain, and derived names that collide take a
 * derived name with a numeric suffix, in iteration order.
 */
export function variableCSSNames(variables: Iterable<Variable>): Map<string, string> {
  const list = [...variables]
  const names = new Map<string, string>()
  const taken = new Set<string>()
  for (const variable of list) {
    if (!variable.cssName || taken.has(variable.cssName)) continue
    names.set(variable.id, variable.cssName)
    taken.add(variable.cssName)
  }
  for (const variable of list) {
    if (names.has(variable.id)) continue
    const base = deriveCSSName(variable)
    let name = base
    for (let n = 2; taken.has(name); n++) name = `${base}-${n}`
    names.set(variable.id, name)
    taken.add(name)
  }
  return names
}

/**
 * The unit a FLOAT token is written in. An explicit unit wins; otherwise opacity and font
 * weights are unitless and every other number is a pixel length, which is what the canvas draws.
 */
export function variableUnit(variable: Variable): TokenUnit {
  if (variable.type !== 'FLOAT') return 'none'
  if (variable.unit) return variable.unit
  const namespace = variableNamespace(variable)
  return namespace && UNITLESS_NAMESPACES.has(namespace) ? 'none' : 'px'
}

function trimNumber(value: number): string {
  return String(Number(value.toFixed(4)))
}

/** A stored number written in its unit: 24 as `rem` is `1.5rem`, 150 as `ms` is `150ms`. */
export function tokenNumberToCSS(value: number, unit: TokenUnit): string {
  if (unit === 'none') return trimNumber(value)
  if (unit === 'rem') return `${trimNumber(value / ROOT_FONT_SIZE_PX)}rem`
  if (value === 0 && unit === 'px') return '0'
  return `${trimNumber(value)}${unit}`
}

/** The stored number for a value typed in a unit: `1.5` in `rem` is 24 canvas pixels. */
export function tokenNumberFromUnit(value: number, unit: TokenUnit): number {
  return unit === 'rem' ? value * ROOT_FONT_SIZE_PX : value
}
