import { compact } from 'es-toolkit/array'
import valueParser from 'postcss-value-parser'
import { themeNamespaces, type ThemeNamespace } from 'twirlwind'

import type { SceneGraph, Variable, VariableScope } from '@open-pencil/scene-graph'

/** Every variable, collection by collection, in each collection's own order. */
export function collectionVariables(
  source: Pick<SceneGraph, 'variables' | 'variableCollections'>
): Variable[] {
  return compact(
    [...source.variableCollections.values()].flatMap((collection) =>
      collection.variableIds.map((id) => source.variables.get(id))
    )
  )
}

const SCOPE_NAMESPACES: Partial<Record<VariableScope, ThemeNamespace>> = {
  CORNER_RADIUS: 'radius',
  GAP: 'spacing',
  WIDTH_HEIGHT: 'spacing',
  FONT_SIZE: 'text',
  LINE_HEIGHT: 'leading',
  LETTER_SPACING: 'tracking',
  FONT_FAMILY: 'font',
  FONT_STYLE: 'font-weight',
  EFFECT_FLOAT: 'blur'
}

/** Leading name segments that already say the namespace, so `Color/primary` is not `--color-color-primary`. */
const NAMESPACE_WORDS: Record<string, ThemeNamespace> = {
  ...Object.fromEntries(themeNamespaces.map((namespace) => [namespace, namespace])),
  colors: 'color',
  colour: 'color',
  colours: 'color',
  space: 'spacing',
  radii: 'radius',
  rounded: 'radius',
  corner: 'radius',
  corners: 'radius',
  'font-size': 'text',
  'line-height': 'leading',
  'letter-spacing': 'tracking',
  fonts: 'font',
  'font-family': 'font',
  weight: 'font-weight',
  shadows: 'shadow'
}

/**
 * Lowercase words joined by `-`, keeping digits on their word, as Tailwind keys do: `Text/2xl`
 * is `text-2xl`, `Heading/H1` is `heading-h1`, `brandPrimary` is `brand-primary`. es-toolkit's
 * `kebabCase` splits digits off (`text-2-xl`), which no design system writes.
 */
export function tokenSlug(text: string): string {
  const words = text
    .normalize('NFKC')
    .replaceAll(/(\p{Ll})(\p{Lu})/gu, '$1 $2')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
  return compact(words).join('-')
}

/** The Tailwind namespace a token belongs to, from its type, its scopes, then its leading name segment. */
export function variableNamespace(variable: Variable): ThemeNamespace | undefined {
  if (variable.type === 'COLOR') return 'color'
  const fromScopes = new Set((variable.scopes ?? []).map((scope) => SCOPE_NAMESPACES[scope]))
  const [only] = fromScopes
  if (fromScopes.size === 1 && only) return only
  return NAMESPACE_WORDS[tokenSlug(variable.name.split('/')[0] ?? '')]
}

/**
 * The custom property a code snippet names, without `--`: `var(--brand)`, `var(--brand, red)`
 * and `--brand` all name `brand`. A snippet that is anything else, such as a Tailwind class,
 * names none.
 */
export function parseCSSName(snippet: string | undefined): string | undefined {
  const nodes = valueParser(snippet ?? '').nodes.filter((node) => node.type !== 'space')
  const [node] = nodes
  if (nodes.length !== 1) return undefined
  const word =
    node.type === 'function' && node.value === 'var' && 'nodes' in node
      ? node.nodes.find((child) => child.type !== 'space')
      : node
  return word?.type === 'word' && word.value.startsWith('--') && word.value.length > 2
    ? word.value.slice(2)
    : undefined
}

/** The name `codeSyntax.WEB` gives the token, if it gives one. */
export function explicitCSSName(variable: Variable): string | undefined {
  return parseCSSName(variable.codeSyntax?.WEB)
}

/**
 * `Gray/50` as COLOR is `color-gray-50`; `Space/small` is `spacing-small`. Two tokens can derive
 * the same name, so stylesheet output takes names from `variableCSSNames`, which makes them unique.
 */
export function deriveCSSName(variable: Variable): string {
  const namespace = variableNamespace(variable)
  const segments = compact(variable.name.split('/').map(tokenSlug))
  if (segments.length > 1 && namespace && NAMESPACE_WORDS[segments[0] ?? ''] === namespace) {
    segments.shift()
  }
  const body = segments.join('-') || 'token'
  if (!namespace || body === namespace || body.startsWith(`${namespace}-`)) return body
  return `${namespace}-${body}`
}

/**
 * Document-wide custom property names, without `--`. The first token whose `WEB` snippet claims
 * a name keeps it; later claimants, which Figma files do contain, and derived names that collide
 * take a derived name with a numeric suffix, in iteration order.
 */
export function variableCSSNames(variables: Iterable<Variable>): Map<string, string> {
  const list = [...variables]
  const names = new Map<string, string>()
  const taken = new Set<string>()
  for (const variable of list) {
    const name = explicitCSSName(variable)
    if (!name || taken.has(name)) continue
    names.set(variable.id, name)
    taken.add(name)
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

/** The `WEB` snippet that names a token in Figma's Dev Mode and here. */
export function cssNameCodeSyntax(name: string): string {
  return `var(--${name})`
}
