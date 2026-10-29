import { mapValues, omit, pick } from 'es-toolkit/object'

import {
  TEXT_BINDABLE_FIELDS,
  type CharacterStyleOverride,
  type SceneGraph,
  type SceneNode,
  type StyleRun,
  type TextBindableField,
  type Variable
} from '@open-pencil/scene-graph'
import { copyFills } from '@open-pencil/scene-graph/copy'
import { parseFontStyle } from '@open-pencil/scene-graph/font-style'
import { getSharedStyles, SHARED_TEXT_STYLE_FIELDS } from '@open-pencil/scene-graph/shared-styles'

import { variableAlias, type FigmaVariableAlias } from '#core/figma-api/variables/values'
import { styleRunsWithPatch } from '#core/text/character-style'

import { getStyledTextSegments } from './style'

/** Fields a string variable binds; the rest take numbers. */
const STRING_FIELDS: ReadonlySet<TextBindableField> = new Set(['fontFamily', 'fontStyle'])
const PARAGRAPH_FIELDS = new Set(['paragraphSpacing', 'paragraphIndent'] as const)

function isParagraphField(
  field: TextBindableField
): field is 'paragraphSpacing' | 'paragraphIndent' {
  return (PARAGRAPH_FIELDS as ReadonlySet<string>).has(field)
}

/**
 * The style a text or fill style gives characters that use it, with the reference that keeps
 * them attached. An empty ID detaches them; a style the document does not hold attaches by ID
 * alone, as the text's own setters do.
 */
export function rangeSharedStylePatch(
  graph: SceneGraph,
  kind: 'text' | 'fill',
  styleId: string
): CharacterStyleOverride {
  const key = kind === 'text' ? 'textStyleId' : 'fillStyleId'
  if (!styleId) return { [key]: null }
  const found = getSharedStyles(graph, kind).find((style) => style.id === styleId)
  const style = found ? graph.getNode(found.nodeId) : undefined
  if (!style) return { [key]: styleId }
  if (kind === 'fill') return { fillStyleId: styleId, fills: copyFills(style.fills) }
  return { textStyleId: styleId, ...structuredClone(pick(style, SHARED_TEXT_STYLE_FIELDS)) }
}

/** Figma's message for a text field it cannot bind. */
export function assertTextBindableField(method: string, field: unknown): TextBindableField {
  if (!(TEXT_BINDABLE_FIELDS as readonly unknown[]).includes(field)) {
    throw new Error(
      `in ${method}: Property "field" failed validation: Invalid enum value. Expected ` +
        `${TEXT_BINDABLE_FIELDS.map((name) => `'${name}'`).join(' | ')}, received '${String(field)}'`
    )
  }
  return field as TextBindableField
}

/** The variable a binding takes: one the document holds, of the type the field takes. */
function boundVariable(
  graph: SceneGraph,
  method: string,
  field: TextBindableField,
  variable: unknown
): Variable {
  const id = (variable as { id?: unknown } | null)?.id
  const found = typeof id === 'string' ? graph.variables.get(id) : undefined
  if (!found) throw new Error(`in ${method}: Variable not found`)
  const expected = STRING_FIELDS.has(field) ? 'STRING' : 'FLOAT'
  if (found.type !== expected) {
    throw new Error(
      `in ${method}: Cannot bind a ${found.type} variable to "${field}", which takes ${expected}`
    )
  }
  return found
}

/** What the characters show for a bound field: the variable's value in their mode. */
function boundValue(
  graph: SceneGraph,
  node: SceneNode,
  field: TextBindableField,
  variable: Variable
): CharacterStyleOverride {
  if (STRING_FIELDS.has(field)) {
    const value = graph.resolveVariableForNode(node.id, variable.id)
    if (typeof value !== 'string') return {}
    if (field === 'fontFamily') return { fontFamily: value }
    const { weight, italic } = parseFontStyle(value)
    return { fontWeight: weight, italic }
  }
  const value = graph.resolveNumberVariableForNode(node.id, variable.id)
  if (value === undefined || !Number.isFinite(value) || isParagraphField(field)) return {}
  return { [field]: value }
}

/**
 * The runs that bind `field` of `text[start, end)` to a variable, or unbind it, showing the
 * variable's value there as Figma does, and the value a bound paragraph spacing or indent gives
 * the range's paragraphs.
 */
export function rangeBindingChanges(
  graph: SceneGraph,
  node: SceneNode,
  start: number,
  end: number,
  field: TextBindableField,
  variable: unknown
): { styleRuns: StyleRun[]; paragraphValue: number | null } {
  const bound =
    variable === null ? null : boundVariable(graph, 'setRangeBoundVariable', field, variable)
  const value = bound ? boundValue(graph, node, field, bound) : {}
  let styleRuns = node.styleRuns
  // Characters bound apart keep their other bindings.
  for (const segment of getStyledTextSegments(node, ['boundVariables'], start, end)) {
    const aliases = (segment.boundVariables ?? {}) as Record<string, FigmaVariableAlias>
    const ids = mapValues(aliases, (alias) => alias.id)
    const boundVariables = bound ? { ...ids, [field]: bound.id } : omit(ids, [field])
    styleRuns = styleRunsWithPatch({ ...node, styleRuns }, segment.start, segment.end, {
      ...value,
      boundVariables
    })
  }
  const resolved = bound ? graph.resolveNumberVariableForNode(node.id, bound.id) : undefined
  const paragraphValue =
    isParagraphField(field) && resolved !== undefined && Number.isFinite(resolved)
      ? Math.max(0, resolved)
      : null
  return { styleRuns, paragraphValue }
}

/** The variable `field` of every character of the range is bound to, `null`, or `mixed`. */
export function getRangeBoundVariable(
  node: SceneNode,
  start: number,
  end: number,
  field: TextBindableField,
  mixed: symbol
): FigmaVariableAlias | null | symbol {
  const segments = getStyledTextSegments(node, ['boundVariables'], start, end)
  const ids = new Set(
    segments.map(
      (segment) =>
        (segment.boundVariables as Partial<Record<string, FigmaVariableAlias>> | undefined)?.[field]
          ?.id ?? null
    )
  )
  if (ids.size > 1) return mixed
  const [id] = ids
  return id ? variableAlias(id) : null
}
