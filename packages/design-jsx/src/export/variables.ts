import { camelCase, compact, groupBy, isEqual, mapValues, sortBy } from 'es-toolkit'

import { jsx } from '@open-pencil/emit'
import type {
  SceneGraph,
  Variable,
  VariableCollection,
  VariableValue
} from '@open-pencil/scene-graph'
import { modesDefaultFirst } from '@open-pencil/scene-graph/variables'

import { DESIGN_JSX_ELEMENTS } from '../elements'
import { layersUnder } from '../figjam/connectors'
import { DESIGN_JSX_HELPERS } from '../helpers'
import { DEFAULT_MODE_NAME, designMode, designVar, type DesignVariable } from '../variables'
import { collectionNamed, resolveVariableId, variableModes } from '../variables/graph'
import { formatColor } from './helpers'
import { helperCall, Reference, valueSyntax, type JSXValue } from './value'

/** How an export writes the variables its layers bind and the modes they pin. */
export interface VariableExport {
  variable(variableId: string): JSXValue
  mode(collectionId: string, modeId: string): JSXValue
  /** The `defineVars` and `defineMode` statements the JSX refers to, if it declares any. */
  declarations(): string
  /** The names those statements declare, which other declarations must not take. */
  names: ReadonlySet<string>
}

/**
 * Variables and modes by reference to the document's own, as `designVar` and `designMode` find
 * them: by name when it is unique, then by collection and name, and by ID otherwise.
 */
export function variableReferences(graph: SceneGraph): VariableExport {
  // A reference is written only when rendering would resolve it back to the same variable.
  const finds = (handle: DesignVariable, variableId: string) => {
    try {
      return resolveVariableId(graph, handle) === variableId
    } catch {
      return false
    }
  }
  // A collection name several collections share names none of them; its ID still does.
  const findsMode = (collection: string, mode: string, collectionId: string, modeId: string) => {
    try {
      return variableModes(graph, designMode(collection, mode))?.[collectionId] === modeId
    } catch {
      return false
    }
  }
  return {
    names: new Set(),
    variable(variableId) {
      const variable = graph.variables.get(variableId)
      if (!variable) return variableId
      if (finds(designVar(variable.name), variableId)) return helperCall('designVar', variable.name)
      const collection = graph.variableCollections.get(variable.collectionId)
      return collection && finds(designVar(collection.name, variable.name), variableId)
        ? helperCall('designVar', collection.name, variable.name)
        : variableId
    },
    mode(collectionId, modeId) {
      const collection = graph.variableCollections.get(collectionId)
      const mode = collection?.modes.find((item) => item.modeId === modeId)
      if (!collection || !mode) return modeId
      const named = [collection.name, collectionId].find((name) =>
        findsMode(name, mode.name, collectionId, modeId)
      )
      return named ? helperCall('designMode', named, mode.name) : modeId
    },
    declarations: () => ''
  }
}

/** The variables the layers under `rootIds` bind. */
function boundVariableIds(graph: SceneGraph, rootIds: readonly string[]): Set<string> {
  return new Set(
    layersUnder(graph, rootIds).flatMap((layer) => Object.values(layer.boundVariables))
  )
}

/** A value `defineVars` can write: a color, a number, a boolean, or an alias. */
function definable(variable: Variable): boolean {
  if (variable.type === 'STRING') return false
  return Object.values(variable.valuesByMode).every(
    (value) =>
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      (typeof value === 'object' && ('aliasId' in value || 'r' in value))
  )
}

/** Words JavaScript reserves, which no `const` may be named, as a mode named Default would be. */
const RESERVED_WORDS = [
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'null',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
  'arguments',
  'eval',
  'undefined',
  'NaN',
  'Infinity'
]

const TAKEN = new Set([
  ...RESERVED_WORDS,
  ...DESIGN_JSX_ELEMENTS.map((element) => element.name),
  ...DESIGN_JSX_HELPERS.map((helper) => helper.name),
  'svg',
  'React'
])

function handleName(name: string, taken: Set<string>, fallback: string): string {
  const camel = camelCase(name)
  const base = /^[A-Za-z_$][\w$]*$/.test(camel) ? camel : fallback
  let candidate = base
  for (let count = 2; taken.has(candidate); count++) candidate = `${base}${count}`
  taken.add(candidate)
  return candidate
}

interface DefinedCollection {
  collection: VariableCollection
  name: string
  variables: Variable[]
  /** Handles for the modes after the first, by mode ID. */
  modes: Map<string, string>
}

/** The variable a value aliases, if it is an alias. */
function aliasOf(value: VariableValue | undefined): string | undefined {
  return typeof value === 'object' && 'aliasId' in value ? value.aliasId : undefined
}

/**
 * Whether rendering finds `variable` again by its collection's name and its own, as definitions
 * are found: a name another collection or variable shares stays a reference rather than redefine
 * whichever comes first.
 */
function findsByName(graph: SceneGraph, variable: Variable): boolean {
  const collection = graph.variableCollections.get(variable.collectionId)
  if (!collection) return false
  try {
    return (
      collectionNamed(graph, collection.name) === collection &&
      resolveVariableId(graph, designVar(collection.name, variable.name)) === variable.id
    )
  } catch {
    return false
  }
}

/** The variables the layers bind that JSX can define, with every variable they alias. */
function definableVariables(graph: SceneGraph, rootIds: readonly string[]): Set<string> {
  const included = new Set<string>()
  const include = (variableId: string) => {
    const variable = graph.variables.get(variableId)
    if (!variable || included.has(variableId) || !definable(variable)) return
    if (!findsByName(graph, variable)) return
    included.add(variableId)
    for (const value of Object.values(variable.valuesByMode)) {
      const target = aliasOf(value)
      if (target) include(target)
    }
  }
  for (const id of boundVariableIds(graph, rootIds)) include(id)
  return included
}

/** The variables by collection, each in its collection's order, as the variables panel lists them. */
function byCollectionOf(graph: SceneGraph, included: Set<string>): Map<string, Variable[]> {
  const variables = compact([...included].map((id) => graph.variables.get(id)))
  const grouped = mapValues(
    groupBy(variables, (variable) => variable.collectionId),
    (members, collectionId) => {
      const listed = graph.variableCollections.get(collectionId)?.variableIds ?? []
      return sortBy(members, [(variable) => listed.indexOf(variable.id)])
    }
  )
  return new Map(Object.entries(grouped))
}

/** The collections in the order they are declared: after the ones their first mode aliases. */
function declarationOrder(graph: SceneGraph, byCollection: Map<string, Variable[]>): string[] {
  const order: string[] = []
  const visiting = new Set<string>()
  const visit = (collectionId: string) => {
    if (order.includes(collectionId) || visiting.has(collectionId)) return
    visiting.add(collectionId)
    const collection = graph.variableCollections.get(collectionId)
    for (const variable of byCollection.get(collectionId) ?? []) {
      const target = collection && aliasOf(variable.valuesByMode[collection.defaultModeId])
      const aliased = target ? graph.variables.get(target) : undefined
      if (aliased) visit(aliased.collectionId)
    }
    order.push(collectionId)
  }
  for (const id of byCollection.keys()) visit(id)
  return order
}

/**
 * What an export declares: the variables it can define and still have its code run. A first-mode
 * value can only name a collection declared before its own, so one that aliases its own
 * collection, or a later one in a cycle, is written by reference, which keeps the alias; and a
 * declared value may alias only a declared variable, so one that aliases a reference, in any mode,
 * is written by reference too.
 */
function declaredVariables(graph: SceneGraph, rootIds: readonly string[]) {
  const included = definableVariables(graph, rootIds)
  let byCollection = byCollectionOf(graph, included)
  const order = declarationOrder(graph, byCollection)
  const declaredEarlier = (variable: Variable) => {
    const collection = graph.variableCollections.get(variable.collectionId)
    const target = collection && aliasOf(variable.valuesByMode[collection.defaultModeId])
    const aliased = target && included.has(target) ? graph.variables.get(target) : undefined
    return !aliased || order.indexOf(aliased.collectionId) < order.indexOf(variable.collectionId)
  }
  const aliasesDeclared = (variable: Variable) =>
    Object.values(variable.valuesByMode).every((value) => {
      const target = aliasOf(value)
      return !target || included.has(target)
    })
  for (const variable of [...byCollection.values()].flat()) {
    if (!declaredEarlier(variable)) included.delete(variable.id)
  }
  for (let dropped = 1; dropped > 0;) {
    const unresolved = [...included].flatMap((id) => {
      const variable = graph.variables.get(id)
      return variable && !aliasesDeclared(variable) ? [id] : []
    })
    for (const id of unresolved) included.delete(id)
    dropped = unresolved.length
  }
  // What is left is declared only if a layer still uses it, itself or through an alias.
  const used = new Set<string>()
  const use = (variableId: string) => {
    const variable = graph.variables.get(variableId)
    if (!variable || used.has(variableId) || !included.has(variableId)) return
    used.add(variableId)
    for (const value of Object.values(variable.valuesByMode)) {
      const target = aliasOf(value)
      if (target) use(target)
    }
  }
  for (const id of boundVariableIds(graph, rootIds)) use(id)
  for (const id of included) if (!used.has(id)) included.delete(id)
  byCollection = byCollectionOf(graph, included)
  return { included, byCollection, order }
}

/**
 * Writes the collections the layers use as `defineVars`, with a `defineMode` for each mode after
 * the first, so the JSX carries its tokens: only the variables it binds and those they alias.
 * Variables JSX cannot define, such as formulas, and collections whose name is not unique are
 * written by reference.
 */
function definitionExport(graph: SceneGraph, rootIds: readonly string[]): VariableExport {
  const references = variableReferences(graph)
  const { included, byCollection, order } = declaredVariables(graph, rootIds)

  const taken = new Set(TAKEN)
  const defined = new Map<string, DefinedCollection>()
  for (const collectionId of order) {
    const collection = graph.variableCollections.get(collectionId)
    if (!collection || !byCollection.get(collectionId)?.length) continue
    defined.set(collectionId, {
      collection,
      name: handleName(collection.name, taken, 'vars'),
      variables: byCollection.get(collectionId) ?? [],
      modes: new Map()
    })
  }
  for (const entry of defined.values()) {
    for (const mode of modesDefaultFirst(entry.collection).slice(1)) {
      entry.modes.set(mode.modeId, handleName(mode.name, taken, `${entry.name}Mode`))
    }
  }

  const variable = (variableId: string): JSXValue => {
    const found = graph.variables.get(variableId)
    const entry = found && included.has(variableId) ? defined.get(found.collectionId) : undefined
    return entry && found ? new Reference(entry.name, found.name) : references.variable(variableId)
  }
  const value = (raw: VariableValue | undefined): JSXValue | undefined => {
    if (typeof raw === 'number' || typeof raw === 'boolean') return raw
    if (typeof raw !== 'object') return undefined
    if ('aliasId' in raw) return variable(raw.aliasId)
    return 'r' in raw ? formatColor(raw, raw.a) : undefined
  }
  const values = (variables: Variable[], modeId: string, base?: string) =>
    Object.fromEntries(
      variables.flatMap((item) => {
        const written = value(item.valuesByMode[modeId])
        const first = base === undefined ? undefined : value(item.valuesByMode[base])
        if (written === undefined) return []
        if (base !== undefined && isEqual(written, first)) return []
        return [[item.name, written]]
      })
    )

  return {
    names: new Set([...defined.values()].flatMap((entry) => [entry.name, ...entry.modes.values()])),
    variable,
    mode(collectionId, modeId) {
      const name = defined.get(collectionId)?.modes.get(modeId)
      return name ? new Reference(name) : references.mode(collectionId, modeId)
    },
    declarations() {
      // Written as `ref()` declarations are, so the statements read like the JSX after them.
      const statements: string[] = []
      const declare = (name: string, value: JSXValue) =>
        statements.push(`const ${name} = ${jsx.printJSX(valueSyntax(value))}`)
      for (const entry of defined.values()) {
        const [first] = modesDefaultFirst(entry.collection)
        const options = first.name === DEFAULT_MODE_NAME ? undefined : { mode: first.name }
        const call = helperCall(
          'defineVars',
          entry.collection.name,
          values(entry.variables, first.modeId),
          options
        )
        declare(entry.name, call)
      }
      for (const entry of defined.values()) {
        const [first] = modesDefaultFirst(entry.collection)
        for (const [modeId, name] of entry.modes) {
          const mode = entry.collection.modes.find((item) => item.modeId === modeId)
          const call = helperCall(
            'defineMode',
            new Reference(entry.name),
            mode?.name ?? '',
            values(entry.variables, modeId, first.modeId)
          )
          declare(name, call)
        }
      }
      return statements.join('\n')
    }
  }
}

/**
 * How an export writes variables: with `declare`, as the definitions its JSX carries, otherwise
 * by reference to the document's own.
 */
export function variableExport(
  graph: SceneGraph,
  rootIds: readonly string[],
  declare: boolean
): VariableExport {
  return declare ? definitionExport(graph, rootIds) : variableReferences(graph)
}
