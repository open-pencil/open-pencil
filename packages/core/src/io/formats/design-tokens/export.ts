import { compact } from 'es-toolkit/array'
import { omitBy } from 'es-toolkit/object'
import { isEmptyObject } from 'es-toolkit/predicate'

import type {
  SceneGraph,
  Variable,
  VariableCollection,
  VariableCollectionMode
} from '@open-pencil/scene-graph'
import {
  formulaTypeOf,
  isEasing,
  printFormula,
  variableValueReferences
} from '@open-pencil/scene-graph/variables'
import { appendAll } from '@open-pencil/std/arrays'

import { fileSegment, placeTokens, tokenPath, tokenReference, tokenTree } from './paths'
import { styleTokens, withOriginalName, type TokenReferences } from './styles'
import {
  OPENPENCIL_EXTENSION,
  RESOLVER_VERSION,
  type DesignToken,
  type DesignTokenFile,
  type DesignTokenIssue
} from './types'
import { cubicBezierTokenValue, literalTokenValue, variableTokenType } from './values'

export interface DesignTokenExport {
  files: DesignTokenFile[]
  issues: DesignTokenIssue[]
}

/** The resolver document's file name, as DTCG recommends. */
export const RESOLVER_FILE = 'tokens.resolver.json'
/** The composite tokens' file, apart from the mode files because Figma's import refuses them. */
export const STYLES_FILE = 'styles.tokens.json'

/** Names made distinct by numbering repeats: `Theme`, `Theme 2`. */
function distinct(names: readonly string[], reserved: readonly string[] = []): string[] {
  const taken = new Set(reserved)
  return names.map((name) => {
    let candidate = name
    for (let count = 2; taken.has(candidate); count++) candidate = `${name} ${count}`
    taken.add(candidate)
    return candidate
  })
}

/** The resolver set that holds the styles file, a name no collection may take there. */
const STYLES_SET = 'Styles'

/** A JSON pointer segment: `~` and `/` are escaped as RFC 6901 requires. */
function pointerSegment(name: string): string {
  return name.replaceAll('~', '~0').replaceAll('/', '~1')
}

interface ExportContext {
  graph: SceneGraph
  references: TokenReferences
  collectionOf: ReadonlyMap<string, VariableCollection>
  issues: DesignTokenIssue[]
}

/** OpenPencil's own token fields, which DTCG has no place for. */
function openPencilFields(variable: Variable, modeId: string, formula?: string) {
  const fields = omitBy(
    {
      unit: variable.unit,
      expression: variable.expressions?.[modeId]?.css,
      formula,
      scopes: variable.scopes,
      codeSyntax: variable.codeSyntax,
      hiddenFromPublishing: variable.hiddenFromPublishing || undefined
    },
    (value) => value === undefined
  )
  return isEmptyObject(fields) ? {} : { [OPENPENCIL_EXTENSION]: fields }
}

/** Whether an easing resolves, in this mode, to a curve a `cubicBezier` token holds. */
function exportableEasing(
  context: ExportContext,
  variable: Variable,
  mode: VariableCollectionMode
): boolean {
  const resolved = context.graph.resolveVariable(variable.id, mode.modeId)
  return isEasing(resolved) && cubicBezierTokenValue(resolved) !== undefined
}

/**
 * An alias as a `{group.token}` reference, with the target's names for Figma when it is in another
 * collection; or why it has none. A spring or hold has no token, so an alias to one would name a
 * token that is not there.
 */
function aliasTokenValue(
  context: ExportContext,
  collection: VariableCollection,
  mode: VariableCollectionMode,
  variable: Variable,
  aliasId: string
):
  | { value: string; figma: Record<string, unknown> }
  | { issue: 'unsupported-easing' | 'missing-alias' } {
  if (variable.type === 'EASING' && !exportableEasing(context, variable, mode))
    return { issue: 'unsupported-easing' }
  const path = context.references.get(aliasId)
  const target = context.graph.variables.get(aliasId)
  const targetCollection = context.collectionOf.get(aliasId)
  if (!path || !target || !targetCollection) return { issue: 'missing-alias' }
  const figma =
    targetCollection.id === collection.id
      ? {}
      : {
          'com.figma.aliasData': {
            targetVariableName: target.name,
            targetVariableSetName: targetCollection.name
          }
        }
  return { value: tokenReference(path), figma }
}

/**
 * A variable's value in one mode as a token. An alias is a `{group.token}` reference; one to
 * another collection also names its target in `com.figma.aliasData`, the way Figma resolves it.
 */
function variableToken(
  context: ExportContext,
  collection: VariableCollection,
  mode: VariableCollectionMode,
  variable: Variable
): DesignToken | undefined {
  const where = { collection: collection.name, mode: mode.name, token: variable.name }
  if (!Object.hasOwn(variable.valuesByMode, mode.modeId)) {
    context.issues.push({ kind: 'missing-value', ...where })
    return undefined
  }
  const value = variable.valuesByMode[mode.modeId]
  const figma: Record<string, unknown> = {}
  let $value: unknown
  let formula: string | undefined
  if (typeof value === 'object' && 'expression' in value && value.expression === 'FORMULA') {
    // DTCG has no formulas: the token holds this mode's result and keeps the formula beside it.
    const resolved = context.graph.resolveVariable(variable.id, mode.modeId)
    const missing = variableValueReferences(value).some((id) => !context.references.has(id))
    if (missing || resolved === undefined) {
      context.issues.push({ kind: 'missing-alias', ...where })
      return undefined
    }
    formula = printFormula(value.value, (id) => tokenReference(context.references.get(id) ?? []), {
      type: (id) => formulaTypeOf(context.graph.variables.get(id)?.type)
    })
    $value = literalTokenValue(variable, resolved, context.graph.documentColorSpace)
  } else if (typeof value === 'object' && 'expression' in value) {
    context.issues.push({ kind: 'unsupported-expression', ...where })
    return undefined
  } else if (typeof value === 'object' && 'aliasId' in value) {
    const alias = aliasTokenValue(context, collection, mode, variable, value.aliasId)
    if ('issue' in alias) {
      context.issues.push({ kind: alias.issue, ...where })
      return undefined
    }
    $value = alias.value
    Object.assign(figma, alias.figma)
  } else {
    $value = literalTokenValue(variable, value, context.graph.documentColorSpace)
    if ($value === undefined) {
      context.issues.push({ kind: 'unsupported-easing', ...where })
      return undefined
    }
  }
  if (variable.type === 'BOOLEAN') figma['com.figma.type'] = 'boolean'
  const $extensions = { ...figma, ...openPencilFields(variable, mode.modeId, formula) }
  const token: DesignToken = { $type: variableTokenType(variable), $value }
  if (variable.description) token.$description = variable.description
  if (!isEmptyObject($extensions)) token.$extensions = $extensions
  return token
}

/** What a mode file says about its collection and mode, for OpenPencil to read back. */
function modeExtension(collection: VariableCollection, mode: VariableCollectionMode) {
  return {
    [OPENPENCIL_EXTENSION]: omitBy(
      {
        collection: collection.name,
        mode: mode.name,
        default: mode.modeId === collection.defaultModeId,
        condition: mode.condition,
        modeAttribute: collection.modeAttribute
      },
      (value) => value === undefined
    )
  }
}

interface CollectionFiles {
  collection: VariableCollection
  name: string
  modes: Array<{ name: string; path: string; isDefault: boolean }>
}

/** The resolver: one modifier per collection with several modes, one set per single-mode one. */
function resolverDocument(collections: readonly CollectionFiles[], stylesPath: string | null) {
  const sets: Record<string, unknown> = {}
  const modifiers: Record<string, unknown> = {}
  const resolutionOrder: Array<{ $ref: string }> = []
  for (const { name, modes } of collections) {
    if (modes.length === 1) {
      sets[name] = { sources: [{ $ref: modes[0].path }] }
      resolutionOrder.push({ $ref: `#/sets/${pointerSegment(name)}` })
      continue
    }
    modifiers[name] = {
      contexts: Object.fromEntries(modes.map((mode) => [mode.name, [{ $ref: mode.path }]])),
      default: modes.find((mode) => mode.isDefault)?.name ?? modes[0].name
    }
    resolutionOrder.push({ $ref: `#/modifiers/${pointerSegment(name)}` })
  }
  if (stylesPath) {
    sets[STYLES_SET] = { sources: [{ $ref: stylesPath }] }
    resolutionOrder.push({ $ref: `#/sets/${STYLES_SET}` })
  }
  const resolver: Record<string, unknown> = { version: RESOLVER_VERSION }
  if (!isEmptyObject(sets)) resolver.sets = sets
  if (!isEmptyObject(modifiers)) resolver.modifiers = modifiers
  resolver.resolutionOrder = resolutionOrder
  return resolver
}

/**
 * The document's variables and styles as W3C design tokens: one file per collection mode, which
 * Figma imports as a mode, a file of typography and shadow tokens from text and effect styles,
 * and a resolver document that combines them. OpenPencil's own fields ride in
 * `$extensions["dev.openpencil"]`, so reading the export back loses nothing.
 */
export function exportDesignTokens(graph: SceneGraph): DesignTokenExport {
  const issues: DesignTokenIssue[] = []
  const collections = graph.getLiveCollections()
  const references = new Map<string, string[]>()
  const collectionOf = new Map<string, VariableCollection>()
  const placedByCollection = new Map<string, Array<{ variable: Variable; path: string[] }>>()
  for (const collection of collections) {
    const variables = compact(collection.variableIds.map((id) => graph.variables.get(id)))
    const { placed, duplicates } = placeTokens(
      variables.map((variable) => ({ key: variable, path: tokenPath(variable.name) }))
    )
    for (const variable of duplicates)
      issues.push({ kind: 'duplicate-path', collection: collection.name, token: variable.name })
    placedByCollection.set(
      collection.id,
      [...placed].map(([variable, path]) => ({ variable, path }))
    )
    for (const [variable, path] of placed) {
      references.set(variable.id, path)
      collectionOf.set(variable.id, collection)
    }
  }
  const context: ExportContext = { graph, references, collectionOf, issues }
  const files: DesignTokenFile[] = []
  const styles = styleTokens(graph, references)
  appendAll(issues, styles.issues)
  const stylesPath = styles.tokens.length > 0 ? STYLES_FILE : null
  const folders = distinct(collections.map((collection) => fileSegment(collection.name)))
  const collectionNames = distinct(
    collections.map((collection) => collection.name),
    stylesPath ? [STYLES_SET] : []
  )
  const collectionFiles = collections.map((collection, index): CollectionFiles => {
    const fileNames = distinct(collection.modes.map((mode) => fileSegment(mode.name)))
    const modeNames = distinct(collection.modes.map((mode) => mode.name))
    const modes = collection.modes.map((mode, modeIndex) => {
      const path = `${folders[index]}/${fileNames[modeIndex]}.tokens.json`
      const tokens = (placedByCollection.get(collection.id) ?? []).flatMap(
        ({ variable, path: tokenAt }) => {
          const token = variableToken(context, collection, mode, variable)
          return token
            ? [{ path: tokenAt, token: withOriginalName(token, variable.name, tokenAt) }]
            : []
        }
      )
      files.push({
        path,
        content: { ...tokenTree(tokens), $extensions: modeExtension(collection, mode) }
      })
      return {
        name: modeNames[modeIndex],
        path,
        isDefault: mode.modeId === collection.defaultModeId
      }
    })
    return { collection, name: collectionNames[index], modes }
  })
  if (stylesPath) files.push({ path: stylesPath, content: tokenTree(styles.tokens) })
  if (files.length > 0)
    files.push({ path: RESOLVER_FILE, content: resolverDocument(collectionFiles, stylesPath) })
  return { files, issues }
}
