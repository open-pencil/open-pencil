import { compact } from 'es-toolkit/array'

import type {
  CodeSyntaxPlatform,
  SceneGraph,
  TokenUnit,
  Variable,
  VariableCollection,
  VariableScope,
  VariableType,
  VariableValue
} from '@open-pencil/scene-graph'

import {
  decodeVariableToken,
  referencePath,
  type DecodedValue,
  type DecodedVariable,
  type DecodeFailure
} from './decode'
import { pathName } from './paths'
import { planStyles, type PlannedStyle } from './plan-styles'
import type { DesignTokenBundle, ReadCollection, ReadToken } from './read'

/** Where an imported collection goes: a new collection, an existing one, or nowhere. */
export type CollectionTarget =
  | { kind: 'new'; name: string }
  | { kind: 'existing'; collectionId: string }
  | { kind: 'skip' }

/** Where an imported mode's values go within its target collection. */
export type ModeTarget =
  | { kind: 'new'; name: string }
  | { kind: 'existing'; modeId: string }
  | { kind: 'skip' }

/** The user's choice for one collection of the bundle, its modes in the bundle's order. */
export interface CollectionImportChoice {
  target: CollectionTarget
  modes: ModeTarget[]
}

export interface TokenImportOptions {
  collections: CollectionImportChoice[]
  /** Add tokens no variable matches yet; matching ones are updated either way. */
  addMissing: boolean
  /** Make text and effect styles from typography and shadow tokens. */
  styles: boolean
}

/** Why a token or value was left out. */
export type ImportSkipReason =
  | DecodeFailure
  | 'type-mismatch'
  | 'missing-alias'
  | 'not-added'
  | 'mixed-types'

export interface ImportSkip {
  name: string
  collection: string | undefined
  reason: ImportSkipReason
}

/** What a reference comes to: a token the import read, or a value already in the document. */
export type ResolvedReference =
  | { kind: 'token'; token: ReadToken }
  | { kind: 'value'; value: VariableValue }

/** A variable an alias points at: one already in the document, or one this import plans. */
export type AliasTarget =
  | { kind: 'variable'; variableId: string }
  | { kind: 'planned'; collection: number; variable: number }

export type PlannedValue =
  | { kind: 'literal'; value: Exclude<DecodedValue, { kind: 'alias' }>['value'] }
  | { kind: 'alias'; target: AliasTarget }

export interface PlannedVariable {
  name: string
  type: VariableType
  /** The variable updated, or null for one the import adds. */
  existingId: string | null
  /** Values by planned mode; undefined leaves that mode as it is. */
  values: Array<PlannedValue | undefined>
  expressions: Array<string | undefined>
  unit?: TokenUnit
  scopes?: VariableScope[]
  codeSyntax?: Partial<Record<CodeSyntaxPlatform, string>>
  hiddenFromPublishing?: boolean
  description?: string
}

export interface PlannedMode {
  name: string
  target: Exclude<ModeTarget, { kind: 'skip' }>
  isDefault: boolean
  condition: string | undefined
}

export interface PlannedCollection {
  name: string
  target: Exclude<CollectionTarget, { kind: 'skip' }>
  modes: PlannedMode[]
  modeAttribute: string | undefined
  variables: PlannedVariable[]
}

export interface TokenImportPlan {
  collections: PlannedCollection[]
  styles: PlannedStyle[]
  skipped: ImportSkip[]
  counts: { added: number; updated: number; skipped: number }
}

/** Collections and modes matched by name; anything without a match is new. */
export function defaultTokenImportOptions(
  graph: SceneGraph,
  bundle: DesignTokenBundle
): TokenImportOptions {
  const existing = [...graph.variableCollections.values()]
  const claimed = new Set<string>()
  return {
    collections: bundle.collections.map((collection): CollectionImportChoice => {
      const match = existing.find(
        (candidate) => candidate.name === collection.name && !claimed.has(candidate.id)
      )
      if (match) claimed.add(match.id)
      if (!match) {
        return {
          target: { kind: 'new', name: collection.name },
          modes: collection.modes.map((mode) => ({ kind: 'new', name: mode.name }))
        }
      }
      return {
        target: { kind: 'existing', collectionId: match.id },
        modes: collection.modes.map((mode): ModeTarget => {
          const modeMatch = match.modes.find((candidate) => candidate.name === mode.name)
          return modeMatch
            ? { kind: 'existing', modeId: modeMatch.modeId }
            : { kind: 'new', name: mode.name }
        })
      }
    }),
    addMissing: true,
    styles: true
  }
}

/** A collection's tokens by name, one per mode, in the order they first appear. */
function tokensByName(collection: ReadCollection, modes: readonly number[]) {
  const names = new Map<string, Array<ReadToken | undefined>>()
  modes.forEach((modeIndex, planned) => {
    for (const token of collection.modes[modeIndex].tokens) {
      const row = names.get(token.name) ?? Array.from({ length: modes.length }, () => undefined)
      row[planned] = token
      names.set(token.name, row)
    }
  })
  return names
}

interface Planner {
  graph: SceneGraph
  bundle: DesignTokenBundle
  collections: PlannedCollection[]
  /** By collection, token path joined with `.` to the planned variable's index. */
  paths: Array<Map<string, number>>
  existingByCollection: Array<VariableCollection | undefined>
  skipped: ImportSkip[]
  /** Lookups built once, on first use: large design systems resolve thousands of references. */
  indexes?: PlannerIndexes
}

interface PlannerIndexes {
  /** The document's variables by name. */
  variables: Map<string, Variable[]>
  /** The first planned collection with each name: its index and its variables' indexes by name. */
  planned: Map<string, { index: number; variables: Map<string, number> }>
  /** Tokens by path in each collection's default mode, then composites, first one winning. */
  literals: Map<string, ReadToken>
}

function indexesOf(planner: Planner): PlannerIndexes {
  if (planner.indexes) return planner.indexes
  const variables = new Map<string, Variable[]>()
  for (const variable of planner.graph.variables.values())
    variables.set(variable.name, [...(variables.get(variable.name) ?? []), variable])
  const planned = new Map<string, { index: number; variables: Map<string, number> }>()
  planner.collections.forEach((collection, index) => {
    if (planned.has(collection.name)) return
    const variables = new Map(collection.variables.map((variable, at) => [variable.name, at]))
    planned.set(collection.name, { index, variables })
  })
  const literals = new Map<string, ReadToken>()
  for (const collection of planner.bundle.collections) {
    const mode = collection.modes.find((entry) => entry.isDefault) ?? collection.modes.at(0)
    for (const token of mode?.tokens ?? []) {
      const key = token.path.join('.')
      if (!literals.has(key)) literals.set(key, token)
    }
  }
  for (const token of planner.bundle.composites) {
    const key = token.path.join('.')
    if (!literals.has(key)) literals.set(key, token)
  }
  planner.indexes = { variables, planned, literals }
  return planner.indexes
}

/** A collection's variables by name, the first of any repeated name winning. */
function variablesByName(graph: SceneGraph, collection: VariableCollection | undefined) {
  const byName = new Map<string, Variable>()
  for (const variable of compact(
    (collection?.variableIds ?? []).map((id) => graph.variables.get(id))
  ))
    if (!byName.has(variable.name)) byName.set(variable.name, variable)
  return byName
}

/**
 * The variable an alias names. Figma's alias data names the collection and variable outright;
 * otherwise the path is looked up in the token's own collection, the other imported ones, and
 * then among the document's variables by name.
 */
function aliasTarget(
  planner: Planner,
  from: number,
  value: Extract<DecodedValue, { kind: 'alias' }>
): AliasTarget | undefined {
  const planned = (collection: number, variable: number): AliasTarget => ({
    kind: 'planned',
    collection,
    variable
  })
  const indexes = indexesOf(planner)
  if (value.collection && value.name) {
    const collection = indexes.planned.get(value.collection)
    const variable = collection?.variables.get(value.name)
    if (collection && variable !== undefined) return planned(collection.index, variable)
    const existing = indexes.variables
      .get(value.name)
      ?.find(
        (candidate) =>
          planner.graph.variableCollections.get(candidate.collectionId)?.name === value.collection
      )
    // A named target that is not there, say in a collection left out, is missing: the same
    // path in another collection is a different variable.
    return existing ? { kind: 'variable', variableId: existing.id } : undefined
  }
  const key = value.path.join('.')
  const order = [from, ...planner.paths.keys()].filter(
    (index, at, all) => all.indexOf(index) === at
  )
  for (const index of order) {
    const variable = planner.paths[index]?.get(key)
    if (variable !== undefined) return planned(index, variable)
  }
  const existing = indexes.variables.get(pathName(value.path))?.at(0)
  return existing ? { kind: 'variable', variableId: existing.id } : undefined
}

function targetType(planner: Planner, target: AliasTarget): VariableType | undefined {
  if (target.kind === 'variable') return planner.graph.variables.get(target.variableId)?.type
  return planner.collections[target.collection]?.variables[target.variable]?.type
}

/**
 * A variable with its token fields from the first token that declares a type. An existing
 * variable keeps its type, and a token that declares another is a mismatch; untyped aliases take
 * their target's type in the second pass.
 */
function plannedVariable(
  name: string,
  existing: Variable | undefined,
  decoded: ReadonlyArray<DecodedVariable | undefined>
): PlannedVariable {
  const first = decoded.find((entry) => entry?.type !== undefined)
  const fields = first ?? decoded.find((entry) => entry !== undefined)
  return {
    name,
    type: first?.type ?? existing?.type ?? 'STRING',
    existingId: existing?.id ?? null,
    values: [],
    expressions: decoded.map((entry) => entry?.expression),
    ...tokenFields(fields, existing),
    description: fields?.description
  }
}

/**
 * A variable's unit, scopes, and code syntax. OpenPencil's tokens state them, so theirs replace
 * the variable's; other tools' tokens leave an updated variable's own where they say nothing.
 */
function tokenFields(fields: DecodedVariable | undefined, existing: Variable | undefined) {
  const kept = fields?.own ? undefined : existing
  return {
    unit: fields?.unit ?? kept?.unit,
    scopes: fields?.scopes ?? kept?.scopes,
    codeSyntax: fields?.codeSyntax ?? kept?.codeSyntax,
    hiddenFromPublishing: fields?.hiddenFromPublishing ?? kept?.hiddenFromPublishing
  }
}

/** First pass: which variables each collection plans, typed from tokens that declare a type. */
function planVariables(
  planner: Planner,
  index: number,
  collection: ReadCollection,
  modeIndexes: readonly number[],
  addMissing: boolean
): Array<{ variable: PlannedVariable; decoded: Array<DecodedVariable | undefined> }> {
  const planned = planner.collections[index]
  const paths = new Map<string, number>()
  planner.paths[index] = paths
  const rows: Array<{ variable: PlannedVariable; decoded: Array<DecodedVariable | undefined> }> = []
  const existingByName = variablesByName(planner.graph, planner.existingByCollection[index])
  for (const [name, tokens] of tokensByName(collection, modeIndexes)) {
    const decoded = tokens.map((token) => (token ? decodeVariableToken(token) : undefined))
    const failure = decoded.find((entry) => typeof entry === 'string')
    const usable = decoded.map((entry) => (typeof entry === 'string' ? undefined : entry))
    if (usable.every((entry) => entry === undefined)) {
      planner.skipped.push({
        name,
        collection: collection.name,
        reason: failure ?? 'invalid-value'
      })
      continue
    }
    const existing = existingByName.get(name)
    if (!existing && !addMissing) {
      planner.skipped.push({ name, collection: collection.name, reason: 'not-added' })
      continue
    }
    const variable = plannedVariable(name, existing, usable)
    if (existing && variable.type !== existing.type) {
      planner.skipped.push({ name, collection: collection.name, reason: 'type-mismatch' })
      continue
    }
    for (const token of compact(tokens)) paths.set(token.path.join('.'), planned.variables.length)
    planned.variables.push(variable)
    rows.push({ variable, decoded: usable })
  }
  return rows
}

/** Second pass: values, with aliases resolved now that every planned variable exists. */
function planValues(planner: Planner, index: number, rows: ReturnType<typeof planVariables>): void {
  const collection = planner.collections[index]
  for (const { variable, decoded } of rows) {
    let typed = variable.existingId !== null || decoded.some((entry) => entry?.type !== undefined)
    variable.values = decoded.map((entry) => {
      if (!entry) return undefined
      if (entry.value.kind === 'literal') {
        if (entry.type !== variable.type) {
          planner.skipped.push({
            name: variable.name,
            collection: collection.name,
            reason: 'mixed-types'
          })
          return undefined
        }
        return { kind: 'literal', value: entry.value.value }
      }
      const target = aliasTarget(planner, index, entry.value)
      const type = target && targetType(planner, target)
      if (!target || !type) {
        planner.skipped.push({
          name: variable.name,
          collection: collection.name,
          reason: 'missing-alias'
        })
        return undefined
      }
      if (!typed) {
        variable.type = type
        typed = true
      }
      if (type !== variable.type) {
        planner.skipped.push({
          name: variable.name,
          collection: collection.name,
          reason: 'mixed-types'
        })
        return undefined
      }
      return { kind: 'alias', target }
    })
  }
}

/**
 * What importing a bundle with these choices would do, without doing it: the collections, modes,
 * and variables it adds or updates, the styles it makes, and what it skips and why. Nothing is
 * deleted; a token that matches a variable by name in the target collection updates it.
 */
export function planTokenImport(
  graph: SceneGraph,
  bundle: DesignTokenBundle,
  options: TokenImportOptions
): TokenImportPlan {
  const planner: Planner = {
    graph,
    bundle,
    collections: [],
    paths: [],
    existingByCollection: [],
    skipped: []
  }
  const chosen = bundle.collections.flatMap((collection, bundleIndex) => {
    const choice = options.collections.at(bundleIndex)
    if (!choice || choice.target.kind === 'skip') return []
    const modeIndexes = collection.modes.flatMap((_, modeIndex) =>
      choice.modes[modeIndex]?.kind === 'skip' ? [] : [modeIndex]
    )
    if (modeIndexes.length === 0) return []
    const target = choice.target
    planner.collections.push({
      name: collection.name,
      target,
      modes: modeIndexes.map((modeIndex): PlannedMode => {
        const mode = collection.modes[modeIndex]
        const modeTarget = choice.modes.at(modeIndex)
        return {
          name: mode.name,
          target:
            modeTarget && modeTarget.kind !== 'skip'
              ? modeTarget
              : { kind: 'new', name: mode.name },
          isDefault: mode.isDefault,
          condition: mode.condition
        }
      }),
      modeAttribute: collection.modeAttribute,
      variables: []
    })
    planner.existingByCollection.push(
      target.kind === 'existing' ? graph.variableCollections.get(target.collectionId) : undefined
    )
    return [{ collection, modeIndexes }]
  })
  const rows = chosen.map(({ collection, modeIndexes }, index) =>
    planVariables(planner, index, collection, modeIndexes, options.addMissing)
  )
  rows.forEach((collectionRows, index) => planValues(planner, index, collectionRows))
  const styles = options.styles
    ? planStyles(
        planner.graph,
        bundle,
        (path) => resolveLiteral(planner, path),
        (path) => aliasTarget(planner, 0, { kind: 'alias', path })
      )
    : { styles: [], skipped: [] }
  const skipped = [...planner.skipped, ...styles.skipped]
  const variables = planner.collections.flatMap((collection) => collection.variables)
  const updated =
    variables.filter((variable) => variable.existingId !== null).length +
    styles.styles.filter((style) => style.existingNodeId !== null).length
  const added = variables.length + styles.styles.length - updated
  return {
    collections: planner.collections,
    styles: styles.styles,
    skipped,
    counts: { added, updated, skipped: skipped.length }
  }
}

/**
 * The literal a reference comes to in its collection's default mode, following aliases, for
 * style fields that take values rather than bindings.
 */
function resolveLiteral(
  planner: Planner,
  path: readonly string[],
  depth = 0
): ResolvedReference | undefined {
  if (depth > 16) return undefined
  const indexes = indexesOf(planner)
  const token = indexes.literals.get(path.join('.'))
  if (token) {
    const next = referencePath(token.value)
    return next ? resolveLiteral(planner, next, depth + 1) : { kind: 'token', token }
  }
  const existing = indexes.variables.get(pathName(path))?.at(0)
  const value = existing && planner.graph.resolveVariable(existing.id)
  return value === undefined ? undefined : { kind: 'value', value }
}
