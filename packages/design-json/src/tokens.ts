import {
  isLibraryCollection,
  type SceneGraph,
  type Variable,
  type VariableCollection,
  type VariableLiteral,
  type VariableValue
} from '@open-pencil/scene-graph'
import { colorToHex8 } from '@open-pencil/scene-graph/color'
import {
  getVariablesForCollection,
  resolveVariableInModes
} from '@open-pencil/scene-graph/variables'

/** A token's value in one mode: a color as hex, or the number, text, or flag it holds. */
export type DesignTokenValue = string | number | boolean | null

export interface DesignToken {
  id: string
  name: string
  type: Variable['type']
  description?: string
  /** The value in each mode, by mode name, resolved through aliases; null when it cannot be. */
  values: Record<string, DesignTokenValue>
  /** The token each mode takes its value from, by mode name, for the modes that alias one. */
  aliases?: Record<string, string>
  /** How each platform names the token in code, as Dev Mode shows it. */
  codeSyntax?: Variable['codeSyntax']
}

export interface DesignTokenCollection {
  id: string
  name: string
  /** The mode names, the default first. */
  modes: string[]
  /** Whether the collection is a copy of a library's rather than the document's own. */
  library: boolean
  tokens: DesignToken[]
}

/** Every variable in the document as a token, by collection, with its value in each mode. */
export function designTokens(graph: SceneGraph): DesignTokenCollection[] {
  return [...graph.variableCollections.values()].map((collection) =>
    describeCollection(graph, collection)
  )
}

function describeCollection(
  graph: SceneGraph,
  collection: VariableCollection
): DesignTokenCollection {
  return {
    id: collection.id,
    name: collection.name,
    modes: collection.modes.map((mode) => mode.name),
    library: isLibraryCollection(collection),
    tokens: getVariablesForCollection(graph, collection.id).map((variable) =>
      describeToken(graph, collection, variable)
    )
  }
}

function describeToken(
  graph: SceneGraph,
  collection: VariableCollection,
  variable: Variable
): DesignToken {
  const aliases = modeAliases(graph, collection, variable)
  return {
    id: variable.id,
    name: variable.name,
    type: variable.type,
    description: variable.description || undefined,
    values: Object.fromEntries(
      collection.modes.map((mode) => [mode.name, tokenValue(graph, variable, mode.modeId)])
    ),
    aliases: Object.keys(aliases).length > 0 ? aliases : undefined,
    codeSyntax: variable.codeSyntax
  }
}

/** The value in `modeId`, other collections each in their default mode. */
function tokenValue(graph: SceneGraph, variable: Variable, modeId: string): DesignTokenValue {
  const modeFor = (collectionId: string) =>
    collectionId === variable.collectionId ? modeId : defaultModeOf(graph, collectionId)
  try {
    return literalValue(resolveVariableInModes(graph, variable.id, modeFor))
  } catch {
    // A cycle or a missing variable leaves the mode without a value.
    return null
  }
}

function defaultModeOf(graph: SceneGraph, collectionId: string): string {
  return graph.variableCollections.get(collectionId)?.defaultModeId ?? ''
}

function literalValue(value: VariableLiteral): DesignTokenValue {
  if (typeof value !== 'object') return value
  return colorToHex8(value, value.a)
}

function modeAliases(
  graph: SceneGraph,
  collection: VariableCollection,
  variable: Variable
): Record<string, string> {
  const entries = collection.modes.flatMap((mode) => {
    const aliased = aliasedName(graph, variable.valuesByMode[mode.modeId])
    return aliased ? [[mode.name, aliased]] : []
  })
  return Object.fromEntries(entries)
}

function aliasedName(graph: SceneGraph, value: VariableValue | undefined): string | undefined {
  if (typeof value !== 'object' || !('aliasId' in value)) return undefined
  return graph.variables.get(value.aliasId)?.name ?? value.aliasId
}
