import { groupBy } from 'es-toolkit/array'

import {
  collectionVariables,
  defaultModeCondition,
  tokenNumberToCSS,
  variableCSSNames,
  variableUnit
} from '@open-pencil/dom-css/export'
import type {
  Color,
  SceneGraph,
  Variable,
  VariableCollection,
  VariableValue
} from '@open-pencil/scene-graph'
import { colorToHex } from '@open-pencil/scene-graph/color'

/** One mode's value as the stylesheet writes it, with what the panel previews beside it. */
export interface TokenModeValue {
  modeId: string
  css: string
  color?: Color
  /** The aliased variable's name, when the value points at another token. */
  alias?: string
  /** A CSS expression written instead of the stored number, such as `clamp(…)`. */
  expression?: string
}

export interface TokenRow {
  variable: Variable
  /** The name inside its group: `500` for `Blue/500`. */
  label: string
  cssName: string
  values: TokenModeValue[]
}

export interface TokenGroup {
  /** The name path above the rows, `Blue` for `Blue/500`; empty for top-level tokens. */
  path: string
  rows: TokenRow[]
}

function modeValue(
  graph: SceneGraph,
  variable: Variable,
  modeId: string,
  value: VariableValue | undefined
): TokenModeValue {
  const expression = variable.expressions?.[modeId]?.css
  if (typeof value === 'object' && 'aliasId' in value) {
    const target = graph.variables.get(value.aliasId)
    const color = graph.resolveColorVariable(value.aliasId)
    return { modeId, css: target?.name ?? value.aliasId, alias: target?.name, color, expression }
  }
  if (typeof value === 'object') return { modeId, css: colorToHex(value), color: value, expression }
  if (typeof value === 'number')
    return { modeId, css: tokenNumberToCSS(value, variableUnit(variable)), expression }
  return { modeId, css: value === undefined ? '' : String(value), expression }
}

function splitName(name: string): { path: string; label: string } {
  const at = name.lastIndexOf('/')
  return at === -1
    ? { path: '', label: name }
    : { path: name.slice(0, at), label: name.slice(at + 1) }
}

/** A collection's tokens grouped by their name path, with CSS names unique across the document. */
export function tokenGroups(
  graph: SceneGraph,
  collection: VariableCollection,
  variables: readonly Variable[]
): TokenGroup[] {
  const names = variableCSSNames(collectionVariables(graph))
  const rows = variables.map((variable): TokenRow & { path: string } => {
    const { path, label } = splitName(variable.name)
    return {
      variable,
      path,
      label,
      cssName: names.get(variable.id) ?? variable.id,
      values: collection.modes.map((mode) =>
        modeValue(graph, variable, mode.modeId, variable.valuesByMode[mode.modeId])
      )
    }
  })
  return Object.entries(groupBy(rows, (row) => row.path)).map(([path, grouped]) => ({
    path,
    rows: grouped
  }))
}

/** The condition a mode applies under when it names none, shown as the input's placeholder. */
export function modeConditionPlaceholder(
  collection: VariableCollection,
  modeId: string
): string | undefined {
  if (modeId === collection.defaultModeId) return undefined
  const mode = collection.modes.find((candidate) => candidate.modeId === modeId)
  return mode && defaultModeCondition(collection, mode)
}
