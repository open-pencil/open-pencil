import type {
  SceneGraph,
  Variable,
  VariableCollection,
  VariableCollectionMode,
  VariableValue
} from '@open-pencil/scene-graph'

import { cssColor } from '../export/css'
import { collectionVariables, tokenSlug, variableCSSNames, variableNamespace } from './names'
import { createTokenValidator, parseWithBrowser, type TokenValidator } from './validate'
import { tokenNumberToCSS, variableUnit } from './values'

export type TokenStylesheetFormat = 'css' | 'tailwind'

export type TokenStylesheetIssue = {
  message: string
  variableId?: string
  collectionId?: string
  modeId?: string
}

export type TokenStylesheetOptions = {
  format: TokenStylesheetFormat
  /** Write only these tokens. Names still come from every token, so aliases outside resolve. */
  include?: (variable: Variable) => boolean
}

export type TokenStylesheet = {
  css: string
  issues: TokenStylesheetIssue[]
}

type Declaration = { name: string; value: string }

type ModeScope = {
  collection: VariableCollection
  mode: VariableCollectionMode
  condition: string
  declarations: Declaration[]
}

type TokenSource = Pick<SceneGraph, 'variables' | 'variableCollections'>

function isAtRuleCondition(condition: string): boolean {
  return condition.trim().startsWith('@')
}

/**
 * A mode's name as an identifier. A name with no letters or digits falls back to its id, slugged
 * too: Figma ids such as `1:2` are not valid in a selector value or a variant name as they are.
 * Names that slug alike in one collection, such as `Dark` and `dark!`, are numbered in mode
 * order, so each mode keeps its own selector and variant.
 */
function modeSlug(collection: VariableCollection, mode: VariableCollectionMode): string {
  const plainSlug = ({ name, modeId }: VariableCollectionMode) =>
    tokenSlug(name) || `mode-${tokenSlug(modeId) || 'unnamed'}`
  const taken = new Set<string>()
  for (const candidate of collection.modes) {
    const base = plainSlug(candidate)
    let slug = base
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`
    if (candidate.modeId === mode.modeId) return slug
    taken.add(slug)
  }
  return plainSlug(mode)
}

/** The attribute a collection's manual modes are switched by, unless it names its own. */
export function defaultModeAttributeName(collection: VariableCollection): string {
  return `data-${tokenSlug(collection.name) || 'mode'}`
}

/** The attribute that puts an element in a mode with no condition of its own: `data-theme`. */
export function modeAttribute(
  collection: VariableCollection,
  mode: VariableCollectionMode
): { name: string; value: string } {
  return {
    name: collection.modeAttribute ?? defaultModeAttributeName(collection),
    value: modeSlug(collection, mode)
  }
}

/** The scope a mode applies in when it names none: `[data-theme="dark"]` for Theme / Dark. */
export function defaultModeCondition(
  collection: VariableCollection,
  mode: VariableCollectionMode
): string {
  const { name, value } = modeAttribute(collection, mode)
  return `[${name}="${value}"]`
}

function quoteString(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\a ')}"`
}

/** One mode's value as CSS, or why it has none. */
function modeValue(
  variable: Variable,
  value: VariableValue | undefined,
  modeId: string,
  names: ReadonlyMap<string, string>
): string | { issue: string } {
  const expression = variable.expressions?.[modeId]
  if (expression) return expression.css
  if (value === undefined) return { issue: 'has no value in this mode' }
  if (typeof value === 'object' && 'aliasId' in value) {
    const target = names.get(value.aliasId)
    return target ? `var(--${target})` : { issue: 'aliases a variable that does not exist' }
  }
  if (variable.type === 'COLOR' && typeof value === 'object') return cssColor(value)
  if (variable.type === 'FLOAT' && typeof value === 'number')
    return tokenNumberToCSS(value, variableUnit(variable))
  if (variable.type === 'STRING' && typeof value === 'string')
    return variableNamespace(variable) === 'font' ? value : quoteString(value)
  if (variable.type === 'BOOLEAN') return { issue: 'is a boolean, which CSS has no value for' }
  return { issue: 'has a value that does not match its type' }
}

function aliasTarget(value: VariableValue | undefined): string | undefined {
  return typeof value === 'object' && 'aliasId' in value ? value.aliasId : undefined
}

function block(selector: string, declarations: Declaration[], indent = ''): string {
  const body = declarations.map(({ name, value }) => `${indent}  --${name}: ${value};`).join('\n')
  return `${indent}${selector} {\n${body}\n${indent}}`
}

function modeBlock(scope: ModeScope): string {
  const comment = `/* ${scope.collection.name}: ${scope.mode.name} */`
  if (!isAtRuleCondition(scope.condition))
    return `${comment}\n${block(scope.condition, scope.declarations)}`
  return `${comment}\n${scope.condition} {\n${block(':root', scope.declarations, '  ')}\n}`
}

/** `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));` */
function customVariant(name: string, condition: string): string {
  const body = isAtRuleCondition(condition) ? condition : `&:where(${condition}, ${condition} *)`
  return `@custom-variant ${name} (${body});`
}

/** Variants are named after their mode, prefixed with the collection where two modes share a name. */
function variantNames(scopes: ModeScope[]): string[] {
  const plain = scopes.map(({ collection, mode }) => modeSlug(collection, mode))
  return plain.map((name, index) => {
    const shared = plain.filter((other) => other === name).length > 1
    const collection = scopes[index]?.collection.name ?? ''
    return shared ? `${tokenSlug(collection)}-${name}` : name
  })
}

/**
 * Variables as a stylesheet of custom properties. The default mode of every collection is the
 * base set, in `:root` or, for Tailwind, in `@theme` when the token has a Tailwind namespace;
 * every other mode overrides the values that differ, under its condition. Aliases stay `var()`
 * references and are declared again in each mode that changes what they point to.
 */
export function buildTokenStylesheet(
  source: TokenSource,
  { format, include = () => true }: TokenStylesheetOptions,
  validate: TokenValidator
): TokenStylesheet {
  const issues: TokenStylesheetIssue[] = []
  const collections = [...source.variableCollections.values()]
  const all = collectionVariables(source)
  const names = variableCSSNames(all)
  const variables = all.filter(include)
  const defaultModeOf = (variable: Variable) =>
    source.variableCollections.get(variable.collectionId)?.defaultModeId ?? ''

  function declare(
    variable: Variable,
    modeId: string,
    value: VariableValue | undefined
  ): Declaration | undefined {
    const name = names.get(variable.id) ?? variable.id
    const css = modeValue(variable, value, modeId, names)
    if (typeof css !== 'string') {
      issues.push({ message: `${variable.name} ${css.issue}`, variableId: variable.id, modeId })
      return undefined
    }
    if (!validate.declaration(name, css)) {
      issues.push({
        message: `${variable.name} is not a valid CSS declaration: --${name}: ${css}`,
        variableId: variable.id,
        modeId
      })
      return undefined
    }
    return { name, value: css }
  }

  const defaults = new Map<string, Declaration>()
  const theme: Declaration[] = []
  const root: Declaration[] = []
  for (const variable of variables) {
    const modeId = defaultModeOf(variable)
    const declaration = declare(variable, modeId, variable.valuesByMode[modeId])
    if (!declaration) continue
    defaults.set(variable.id, declaration)
    if (format === 'tailwind' && variableNamespace(variable) !== undefined) theme.push(declaration)
    else root.push(declaration)
  }

  /**
   * What a mode's scope declares: the collection's values that differ from its default, and every
   * alias, in any collection, whose chain reaches one of them. Custom properties inherit as
   * computed values, so `--primary: var(--blue)` resolved at `:root` would keep the old blue
   * unless it is declared again where `--blue` changes.
   */
  function modeDeclarations(
    collection: VariableCollection,
    mode: VariableCollectionMode
  ): Declaration[] {
    const own = (variable: Variable) => variable.collectionId === collection.id
    const valueIn = (variable: Variable) =>
      own(variable)
        ? (variable.valuesByMode[mode.modeId] ?? variable.valuesByMode[collection.defaultModeId])
        : variable.valuesByMode[defaultModeOf(variable)]
    const inMode = new Map<string, Declaration>()
    const scoped = new Map<string, Declaration>()
    for (const variable of variables.filter(own)) {
      const declaration = declare(variable, mode.modeId, valueIn(variable))
      if (!declaration) continue
      inMode.set(variable.id, declaration)
      if (declaration.value !== defaults.get(variable.id)?.value)
        scoped.set(variable.id, declaration)
    }
    for (let grew = true; grew;) {
      grew = false
      for (const variable of variables) {
        const target = aliasTarget(valueIn(variable))
        if (scoped.has(variable.id) || !target || !scoped.has(target)) continue
        const declaration = inMode.get(variable.id) ?? defaults.get(variable.id)
        if (!declaration) continue
        scoped.set(variable.id, declaration)
        grew = true
      }
    }
    return variables.flatMap((variable) => {
      const declaration = scoped.get(variable.id)
      return declaration ? [declaration] : []
    })
  }

  const scopes: ModeScope[] = []
  for (const collection of collections) {
    for (const mode of collection.modes) {
      if (mode.modeId === collection.defaultModeId) continue
      const condition = mode.condition ?? defaultModeCondition(collection, mode)
      if (!validate.condition(condition)) {
        issues.push({
          message: `${collection.name}: ${mode.name} has a condition that is not a selector or a @media, @supports or @container query: ${condition}`,
          collectionId: collection.id,
          modeId: mode.modeId
        })
        continue
      }
      const declarations = modeDeclarations(collection, mode)
      if (declarations.length > 0) scopes.push({ collection, mode, condition, declarations })
    }
  }

  const sections: string[] = []
  if (theme.length > 0) sections.push(block('@theme', theme))
  if (root.length > 0) sections.push(block(':root', root))
  sections.push(...scopes.map(modeBlock))
  if (format === 'tailwind' && scopes.length > 0) {
    const variants = variantNames(scopes)
    sections.push(
      scopes
        .map((scope, index) =>
          customVariant(variants[index] ?? modeSlug(scope.collection, scope.mode), scope.condition)
        )
        .join('\n')
    )
  }
  return { css: sections.length > 0 ? `${sections.join('\n\n')}\n` : '', issues }
}

/**
 * Browsers check token strings with their own CSS parser. Elsewhere, in the CLI and MCP, the CSS
 * object model package loads on first use; its browser build exports nothing, so it is never
 * the browser path.
 */
export async function loadTokenValidator(): Promise<TokenValidator> {
  if (typeof CSSStyleSheet === 'function') return createTokenValidator(parseWithBrowser)
  const headless = await import('./cssom-validator')
  return headless.tokenValidator
}

export async function tokenStylesheet(
  source: TokenSource,
  options: TokenStylesheetOptions
): Promise<TokenStylesheet> {
  return buildTokenStylesheet(source, options, await loadTokenValidator())
}
