import { groupBy, uniq } from 'es-toolkit/array'

import {
  generateId,
  type SceneGraph,
  type SceneNode,
  type Variable,
  type VariableCollectionMode,
  type VariableType,
  type VariableValue
} from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'
import { BLACK } from '@open-pencil/scene-graph/constants'
import type { Color } from '@open-pencil/scene-graph/primitives'

import type { PenDocument, PenNumber, PenVariable, PenVariableScalar } from './schema'

type Theme = Record<string, string>

/**
 * A document's variables, resolved in the theme of the layer being read. pen.dev themes are axes,
 * such as `mode` and `density`, each with its values. The axes a variable's values combine share a
 * collection, whose modes are every combination of one value per axis; an axis no variable
 * combines with another is a collection of its own, as Figma keeps independent modes apart.
 */
export interface VarContext {
  byName: Map<string, Variable>
  resolveColor(ref: string): Color
  resolveNumber(ref: string): number
  /** The number the variable holds, or nothing when it holds none. */
  numberValue(ref: string): number | undefined
  resolveString(ref: string): string
  resolveBoolean(ref: string): boolean
  /** Merges a layer's theme over its parent's until the returned function is called. */
  enterTheme(theme: Theme): () => void
  /**
   * The modes a layer setting `theme` takes: in each collection holding one of its axes, the mode
   * of the theme being read.
   */
  variableModes(theme: Theme): Record<string, string>
}

export function isVarRef(val: unknown): val is `$${string}` {
  return typeof val === 'string' && val.startsWith('$') && val.length > 1
}

function varName(ref: string): string {
  return ref.slice(1)
}

export function bindIfVar(node: SceneNode, field: string, val: unknown, ctx: VarContext): void {
  if (!isVarRef(val)) return
  const variable = ctx.byName.get(varName(val))
  if (variable) node.boundVariables[field] = variable.id
}

/** A number, or the value of the number variable it references. */
export function resolveNumber(value: PenNumber | undefined, ctx: VarContext, fallback = 0): number {
  if (value === undefined) return fallback
  if (typeof value === 'number') return value
  if (isVarRef(value)) return ctx.resolveNumber(value)
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** A number, or the value of the number variable it references; nothing where there is none. */
export function resolveOptionalNumber(
  value: PenNumber | undefined,
  ctx: VarContext
): number | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'number') return value
  if (isVarRef(value)) return ctx.numberValue(value)
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** A boolean, or the value of the variable it references. */
export function resolveBoolean(
  value: boolean | string | undefined,
  ctx: VarContext,
  fallback = true
): boolean {
  if (value === undefined) return fallback
  if (typeof value === 'boolean') return value
  return isVarRef(value) ? ctx.resolveBoolean(value) : value !== 'false'
}

/** A string, or the value of the string variable it references. */
export function resolveString(value: string | undefined, ctx: VarContext): string | undefined {
  return value !== undefined && isVarRef(value) ? ctx.resolveString(value) : value
}

/**
 * Every value a field can take: the value itself, or the value its variable has in each theme,
 * through aliases, with the empty value where a theme has none, as reading resolves it. For
 * loading what a document may draw before it is read in a theme.
 */
export function possibleValues(value: string | undefined, doc: PenDocument): string[] {
  const axes = themeAxes(doc)
  const found = new Set<string>()
  const seen = new Set<string>()
  const visit = (raw: PenVariableScalar | undefined) => {
    if (raw === undefined) return
    if (!isVarRef(raw)) {
      found.add(String(raw))
      return
    }
    const name = varName(raw)
    const definition = doc.variables?.[name]
    if (!definition || seen.has(name)) return
    seen.add(name)
    const empty = emptyValue(sceneType(definition.type))
    // Only the axes its values name decide which applies.
    for (const theme of combinations(axesOf(definition, axes))) {
      const themed = rawValue(definition, theme)
      if (themed !== undefined) visit(themed)
      else if (typeof empty !== 'object') found.add(String(empty))
    }
  }
  visit(value)
  return [...found]
}

/** A colour, or the value of the colour variable it references. */
export function resolveColor(value: string, ctx: VarContext): Color {
  return isVarRef(value) ? ctx.resolveColor(value) : parseColor(value)
}

function sceneType(type: string): VariableType {
  if (type === 'color') return 'COLOR'
  if (type === 'number') return 'FLOAT'
  if (type === 'boolean') return 'BOOLEAN'
  return 'STRING'
}

/** pen.dev leaves a variable without a value in a theme no entry matches: black, zero, or empty. */
function emptyValue(type: VariableType): VariableValue {
  if (type === 'COLOR') return { ...BLACK }
  if (type === 'FLOAT') return 0
  if (type === 'BOOLEAN') return false
  return ''
}

type Axis = [name: string, values: string[]]

/** The document's theme axes that have values. */
function themeAxes(doc: PenDocument): Axis[] {
  return Object.entries(doc.themes ?? {}).filter(([, values]) => values.length > 0)
}

/** Every combination of one value per axis, the first values first. */
function combinations(axes: Axis[]): Theme[] {
  return axes.reduce<Theme[]>(
    (themes, [axis, values]) =>
      themes.flatMap((theme) => values.map((value) => ({ ...theme, [axis]: value }))),
    [{}]
  )
}

/**
 * A variable's raw value in a full theme. An entry applies when each of its axes has its value in
 * the theme, and a later one replaces an earlier one, as pen.dev 2.21 resolves them.
 */
function rawValue(definition: PenVariable, theme: Theme): PenVariableScalar | undefined {
  if (!Array.isArray(definition.value)) return definition.value
  let found: PenVariableScalar | undefined
  for (const entry of definition.value) {
    const entryTheme = Object.entries(entry.theme ?? {})
    if (entryTheme.every(([axis, value]) => theme[axis] === value)) found = entry.value
  }
  return found
}

function sceneValue(
  raw: PenVariableScalar | undefined,
  type: VariableType,
  ids: ReadonlyMap<string, string>
): VariableValue {
  if (raw === undefined) return emptyValue(type)
  if (isVarRef(raw)) {
    const aliasId = ids.get(varName(raw))
    return aliasId ? { aliasId } : emptyValue(type)
  }
  if (type === 'COLOR') return typeof raw === 'string' ? parseColor(raw) : emptyValue(type)
  if (type === 'FLOAT') return typeof raw === 'number' ? raw : Number(raw) || 0
  if (type === 'BOOLEAN') return typeof raw === 'boolean' ? raw : raw === 'true'
  return String(raw)
}

function themeKey(theme: Theme, axes: Axis[]): string {
  return axes.map(([axis]) => theme[axis]).join('\u0000')
}

/** The document's axes a variable's values name, in the document's order. */
function axesOf(definition: PenVariable, axes: Axis[]): Axis[] {
  if (!Array.isArray(definition.value)) return []
  const named = new Set(definition.value.flatMap((entry) => Object.keys(entry.theme ?? {})))
  return axes.filter(([axis]) => named.has(axis))
}

/** The axes in groups, each joining the axes some variable's values combine, through any chain. */
function axisGroups(axes: Axis[], definitions: PenVariable[]): Axis[][] {
  const parent = new Map(axes.map(([axis]) => [axis, axis]))
  const root = (axis: string): string => {
    const next = parent.get(axis) ?? axis
    return next === axis ? axis : root(next)
  }
  for (const definition of definitions) {
    const named = axesOf(definition, axes)
    const first = named.at(0)
    if (!first) continue
    for (const [axis] of named.slice(1)) parent.set(root(axis), root(first[0]))
  }
  return Object.values(groupBy(axes, ([axis]) => root(axis)))
}

/** A collection for a group of axes: one mode for each combination of their values. */
interface ThemeCollection {
  id: string
  axes: Axis[]
  themes: Theme[]
  modes: VariableCollectionMode[]
  modeByTheme: Map<string, string>
}

function addThemeCollection(graph: SceneGraph, axes: Axis[]): ThemeCollection {
  const themes = combinations(axes)
  const modes: VariableCollectionMode[] = themes.map((theme) => ({
    modeId: generateId(),
    name: axes.length === 0 ? 'Default' : axes.map(([axis]) => theme[axis]).join(' / ')
  }))
  const id = generateId()
  graph.addCollection({
    id,
    name: axes.length === 0 ? 'Variables' : axes.map(([axis]) => axis).join(' / '),
    modes,
    defaultModeId: modes[0].modeId,
    variableIds: []
  })
  const modeByTheme = new Map(
    themes.map((theme, index) => [themeKey(theme, axes), modes[index].modeId])
  )
  return { id, axes, themes, modes, modeByTheme }
}

export function buildVarContext(graph: SceneGraph, doc: PenDocument): VarContext {
  const axes = themeAxes(doc)
  const definitions = Object.entries(doc.variables ?? {})
  const collections = axisGroups(
    axes,
    definitions.map(([, definition]) => definition)
  ).map((group) => addThemeCollection(graph, group))
  const collectionOfAxis = new Map(
    collections.flatMap((collection) => collection.axes.map(([axis]) => [axis, collection]))
  )
  // A variable no axis decides goes with the first axes, where it holds one value in every mode.
  const fallback = collections[0] ?? addThemeCollection(graph, [])
  const collectionFor = (definition: PenVariable) => {
    const first = axesOf(definition, axes).at(0)
    return (first && collectionOfAxis.get(first[0])) ?? fallback
  }

  const ids = new Map(definitions.map(([name]) => [name, generateId()]))
  const byName = new Map<string, Variable>()
  const byId = new Map<string, Variable>()
  const collectionById = new Map<string, ThemeCollection>()
  for (const [name, definition] of definitions) {
    const type = sceneType(definition.type)
    const collection = collectionFor(definition)
    collectionById.set(collection.id, collection)
    const variable: Variable = {
      id: ids.get(name) ?? generateId(),
      name,
      type,
      collectionId: collection.id,
      valuesByMode: Object.fromEntries(
        collection.themes.map((theme, index) => [
          collection.modes[index].modeId,
          sceneValue(rawValue(definition, theme), type, ids)
        ])
      ),
      description: '',
      hiddenFromPublishing: false
    }
    graph.addVariable(variable)
    byName.set(name, variable)
    byId.set(variable.id, variable)
  }

  let current: Theme = Object.fromEntries(axes.map(([axis, values]) => [axis, values[0]]))
  const modeIn = (collection: ThemeCollection) =>
    collection.modeByTheme.get(themeKey(current, collection.axes)) ?? collection.modes[0].modeId

  /** A variable's value in the current theme, following aliases. */
  function resolve(ref: string): VariableValue | undefined {
    let variable = byName.get(varName(ref))
    for (let hops = 0; variable && hops <= byName.size; hops++) {
      const collection = collectionById.get(variable.collectionId)
      const value = collection ? variable.valuesByMode[modeIn(collection)] : undefined
      if (typeof value !== 'object' || !('aliasId' in value)) return value
      variable = byId.get(value.aliasId)
    }
    return undefined
  }

  return {
    byName,
    resolveColor(ref) {
      const value = resolve(ref)
      return typeof value === 'object' && 'r' in value ? value : { ...BLACK }
    },
    resolveNumber(ref) {
      return this.numberValue(ref) ?? 0
    },
    numberValue(ref) {
      const value = resolve(ref)
      return typeof value === 'number' ? value : undefined
    },
    resolveString(ref) {
      const value = resolve(ref)
      return typeof value === 'string' ? value : ''
    },
    resolveBoolean(ref) {
      const value = resolve(ref)
      return typeof value === 'boolean' ? value : value !== undefined && value !== 'false'
    },
    enterTheme(theme) {
      const outer = current
      const known = Object.entries(theme).filter(([axis, value]) =>
        axes.some(([name, values]) => name === axis && values.includes(value))
      )
      current = { ...outer, ...Object.fromEntries(known) }
      return () => {
        current = outer
      }
    },
    variableModes(theme) {
      const touched = uniq(Object.keys(theme).flatMap((axis) => collectionOfAxis.get(axis) ?? []))
      return Object.fromEntries(touched.map((collection) => [collection.id, modeIn(collection)]))
    }
  }
}
