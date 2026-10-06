import { compact, groupBy } from 'es-toolkit/array'

import {
  collectionVariables,
  defaultModeCondition,
  modeAttribute,
  tokenNumberToCSS,
  variableCSSNames,
  variableUnit
} from '@open-pencil/dom-css/export'
import {
  tokenNumberFromUnit,
  tokenNumberInUnit,
  type Color,
  type SceneGraph,
  type Variable,
  type VariableCollection,
  type VariableValue
} from '@open-pencil/scene-graph'
import { colorToHex } from '@open-pencil/scene-graph/color'
import { fuzzyFilter } from '@open-pencil/vue'

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
    // The column's own mode, so Dark previews what the alias gives in Dark.
    const resolved = graph.resolveVariable(value.aliasId, modeId)
    const color = typeof resolved === 'object' && 'r' in resolved ? resolved : undefined
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

/** The attribute that turns a manual mode on, as an element carries it: `data-theme="dark"`. */
export function modeAttributeText(collection: VariableCollection, modeId: string): string {
  const mode = collection.modes.find((candidate) => candidate.modeId === modeId)
  if (!mode) return ''
  const { name, value } = modeAttribute(collection, mode)
  return `${name}="${value}"`
}

/**
 * A number or text value typed for a token, numbers in the token's unit (`1.5` for 24px in a
 * `rem` token). Undefined when the text is not a number for a number token.
 */
export function parseTokenValueText(variable: Variable, text: string): VariableValue | undefined {
  if (variable.type === 'STRING') return text
  if (variable.type !== 'FLOAT') return undefined
  const number = Number(text)
  return text.trim() && Number.isFinite(number)
    ? tokenNumberFromUnit(number, variableUnit(variable))
    : undefined
}

/** A number or text value as it is typed back, numbers in the token's unit. */
export function tokenValueText(variable: Variable, value: VariableValue | undefined): string {
  if (typeof value === 'number')
    return String(Number(tokenNumberInUnit(value, variableUnit(variable)).toFixed(6)))
  return typeof value === 'object' ? '' : String(value ?? '')
}

/** The group paths a collection's tokens use, in list order, for "Move to group". */
export function groupPaths(groups: readonly TokenGroup[]): string[] {
  return groups.flatMap((group) => (group.path ? [group.path] : []))
}

/** What a token is found by: its name, its CSS name with `--`, its description, and its values. */
interface TokenSearchEntry {
  id: string
  name: string
  css: string
  description: string
  values: string[]
}

const TOKEN_SEARCH_KEYS = ['name', 'css', 'description', 'values'] satisfies Array<
  keyof TokenSearchEntry
>

/**
 * The tokens a search matches, with the same fuzzy matching as the command palette, so
 * `--spacing`, `brand primary`, a hex color or an alias name all find what they name. Null when
 * there is nothing to search for, so the list stays whole.
 */
export function searchTokenIds(rows: readonly TokenRow[], query: string): Set<string> | null {
  if (!query.trim()) return null
  const entries = rows.map((row): TokenSearchEntry => ({
    id: row.variable.id,
    name: row.variable.name,
    css: `--${row.cssName}`,
    description: row.variable.description,
    values: row.values.flatMap((value) => compact([value.css, value.alias, value.expression]))
  }))
  return new Set(fuzzyFilter(entries, TOKEN_SEARCH_KEYS, query).map((entry) => entry.id))
}

/** One group in the sidebar: its path, its last segment, how deep it sits, and its tokens. */
export interface GroupEntry {
  path: string
  label: string
  depth: number
  /** Tokens in the group and every group inside it. */
  count: number
}

/** Every group and the groups that contain it, in list order, with counts that include nesting. */
export function groupTree(groups: readonly TokenGroup[]): GroupEntry[] {
  const entries = new Map<string, GroupEntry>()
  for (const group of groups) {
    if (!group.path) continue
    const segments = group.path.split('/')
    segments.forEach((segment, index) => {
      const path = segments.slice(0, index + 1).join('/')
      const entry = entries.get(path) ?? { path, label: segment, depth: index, count: 0 }
      entry.count += group.rows.length
      entries.set(path, entry)
    })
  }
  return [...entries.values()]
}

/** Whether a token's group is `group` or sits inside it. */
export function inGroup(path: string, group: string): boolean {
  return path === group || path.startsWith(`${group}/`)
}

/** A token's name moved into `group`, keeping its own last segment: `Brand/Primary`. */
export function nameInGroup(name: string, group: string): string {
  const label = name.slice(name.lastIndexOf('/') + 1)
  return group ? `${group}/${label}` : label
}

/**
 * A collection's order after moving `sourceId` to `targetIndex` among the `visible` rows. Rows a
 * search or filter hides keep their places, so dragging a filtered list never shuffles them.
 */
export function reorderedVariableIds(
  order: readonly string[],
  visible: readonly string[],
  sourceId: string,
  targetIndex: number
): string[] {
  const moved = visible.filter((id) => id !== sourceId)
  moved.splice(targetIndex, 0, sourceId)
  const shown = new Set(visible)
  let next = 0
  return order.map((id) => (shown.has(id) ? (moved[next++] ?? id) : id))
}

/** A variable a token can alias, labelled for the picker and grouped by its collection. */
export interface AliasCandidate {
  id: string
  name: string
  collection: string
  color?: Color
}

/** Whether `fromId` reaches `targetId` through aliases in any mode. */
function aliasesTo(
  graph: SceneGraph,
  fromId: string,
  targetId: string,
  seen = new Set<string>()
): boolean {
  if (fromId === targetId) return true
  if (seen.has(fromId)) return false
  seen.add(fromId)
  const from = graph.variables.get(fromId)
  return Object.values(from?.valuesByMode ?? {}).some(
    (value) =>
      typeof value === 'object' &&
      'aliasId' in value &&
      aliasesTo(graph, value.aliasId, targetId, seen)
  )
}

/**
 * Variables of the same type a token can point at: never itself, and never one that already
 * points back at it, which would make the two resolve to nothing.
 */
export function aliasCandidates(graph: SceneGraph, variable: Variable): AliasCandidate[] {
  return [...graph.variables.values()].flatMap((candidate) => {
    if (candidate.type !== variable.type || aliasesTo(graph, candidate.id, variable.id)) return []
    return [
      {
        id: candidate.id,
        name: candidate.name,
        collection: graph.variableCollections.get(candidate.collectionId)?.name ?? '',
        color: variable.type === 'COLOR' ? graph.resolveColorVariable(candidate.id) : undefined
      }
    ]
  })
}
