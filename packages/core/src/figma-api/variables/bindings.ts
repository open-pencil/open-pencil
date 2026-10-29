import { uniq } from 'es-toolkit/array'
import { isEmptyObject } from 'es-toolkit/predicate'

import {
  TEXT_BINDABLE_FIELDS,
  type SceneGraph,
  type SceneNode,
  type TextBindableField,
  type Variable,
  type VariableType
} from '@open-pencil/scene-graph'
import { recordInstanceOverride } from '@open-pencil/scene-graph/instances'
import { independentCornerChanges, paintBindingTarget } from '@open-pencil/scene-graph/variables'

import type { FigmaPaint } from '#core/figma-api/paints'
import { reconcileVariableLayouts } from '#core/layout/variables'

import { variableAlias, type FigmaVariableAlias } from './values'

/**
 * The fields Figma's `setBoundVariable` takes, in the order its message lists them, with the
 * document field each one binds. Text style fields bind every character's style instead.
 */
const NODE_FIELDS = {
  height: 'height',
  width: 'width',
  characters: 'text',
  itemSpacing: 'itemSpacing',
  paddingLeft: 'paddingLeft',
  paddingRight: 'paddingRight',
  paddingTop: 'paddingTop',
  paddingBottom: 'paddingBottom',
  visible: 'visible',
  cornerRadius: 'cornerRadius',
  topLeftRadius: 'topLeftRadius',
  topRightRadius: 'topRightRadius',
  bottomLeftRadius: 'bottomLeftRadius',
  bottomRightRadius: 'bottomRightRadius',
  strokeWeight: 'strokeWeight',
  strokeTopWeight: 'borderTopWeight',
  strokeBottomWeight: 'borderBottomWeight',
  strokeLeftWeight: 'borderLeftWeight',
  strokeRightWeight: 'borderRightWeight',
  minWidth: 'minWidth',
  maxWidth: 'maxWidth',
  minHeight: 'minHeight',
  maxHeight: 'maxHeight',
  counterAxisSpacing: 'counterAxisSpacing',
  opacity: 'opacity',
  gridRowGap: 'gridRowGap',
  gridColumnGap: 'gridColumnGap'
} as const

export type FigmaBindableNodeField = keyof typeof NODE_FIELDS
export type FigmaBindableField = FigmaBindableNodeField | TextBindableField

const FIELD_NAMES = [...Object.keys(NODE_FIELDS), ...TEXT_BINDABLE_FIELDS]

const CORNER_FIELDS = [
  'topLeftRadius',
  'topRightRadius',
  'bottomLeftRadius',
  'bottomRightRadius'
] as const

/** Fields only an auto layout or grid container has; elsewhere Figma ignores the binding. */
const CONTAINER_FIELDS: ReadonlySet<string> = new Set([
  'itemSpacing',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'paddingBottom',
  'counterAxisSpacing',
  'gridRowGap',
  'gridColumnGap'
])

const CONTAINER_TYPES: ReadonlySet<string> = new Set([
  'FRAME',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE'
])

/** The variable type each field takes from `setBoundVariable`, which is stricter than the panel. */
function fieldType(field: FigmaBindableField): VariableType {
  if (field === 'characters' || field === 'fontFamily' || field === 'fontStyle') return 'STRING'
  if (field === 'visible') return 'BOOLEAN'
  return 'FLOAT'
}

export function isTextBindableField(field: string): field is TextBindableField {
  return (TEXT_BINDABLE_FIELDS as readonly string[]).includes(field)
}

/** Figma's checks on a field name, in the order it makes them. */
export function assertBindableField(field: unknown): FigmaBindableField {
  if (field === 'fills' || field === 'strokes') {
    throw new Error(
      'in setBoundVariable: fills and strokes variable bindings must be set on paints directly'
    )
  }
  if (typeof field !== 'string' || !FIELD_NAMES.includes(field)) {
    throw new Error(
      'in setBoundVariable: Property "field" failed validation: Invalid option: expected one of ' +
        FIELD_NAMES.map((name) => `"${name}"`).join('|')
    )
  }
  return field as FigmaBindableField
}

/** The variable a `setBoundVariable` call names, by object or by id, checked against the field. */
export function bindingVariable(
  graph: SceneGraph,
  method: string,
  field: FigmaBindableField,
  variable: { readonly id: string } | string
): Variable {
  const id = typeof variable === 'string' ? variable : variable.id
  const found = graph.variables.get(id)
  if (!found) throw new Error(`in ${method}: Variable not found`)
  if (found.type !== fieldType(field)) {
    throw new Error(
      `in ${method}: variable of resolved type '${found.type}' cannot be bound to '${field}'`
    )
  }
  return found
}

/** Whether the layer has the field at all; Figma ignores a binding to one it lacks. */
export function hasBindableField(node: SceneNode, field: FigmaBindableField): boolean {
  if (field === 'characters' || isTextBindableField(field)) return node.type === 'TEXT'
  if (CONTAINER_FIELDS.has(field)) return CONTAINER_TYPES.has(node.type)
  return true
}

/** The document fields a Figma field binds: a uniform corner radius binds every corner. */
function documentFields(field: FigmaBindableNodeField): readonly string[] {
  return field === 'cornerRadius' ? CORNER_FIELDS : [NODE_FIELDS[field]]
}

const isCornerField = (field: string): boolean =>
  field === 'cornerRadius' || (CORNER_FIELDS as readonly string[]).includes(field)

/** Draws the layer corner by corner before a script binds or unbinds one, as Figma does. */
function separateCorners(graph: SceneGraph, node: SceneNode): void {
  const changes = independentCornerChanges(node)
  if (isEmptyObject(changes)) return
  graph.updateNode(node.id, changes)
  recordInstanceOverride(graph, node.id, Object.keys(changes))
}

/**
 * Binds or unbinds the document fields behind a Figma node field, then shows the variable's value
 * on the layer and lays out what it moves.
 */
export function setLayerBinding(
  graph: SceneGraph,
  node: SceneNode,
  field: FigmaBindableNodeField,
  variable: Variable | null
): void {
  // Figma keeps the corners' own bindings when a script unbinds the radius as a whole.
  if (field === 'cornerRadius' && !variable) return
  if (isCornerField(field)) separateCorners(graph, node)
  for (const name of documentFields(field)) {
    if (variable) graph.bindVariable(node.id, name, variable.id)
    else graph.unbindVariable(node.id, name)
  }
  reconcileVariableLayouts(graph, { subtrees: [node.id] })
}

/** Text style fields a text layer itself can hold a binding for. */
const LAYER_TEXT_FIELDS: ReadonlySet<TextBindableField> = new Set([
  'fontFamily',
  'fontSize',
  'letterSpacing',
  'lineHeight'
])

/**
 * Binds a text style field of text with no characters on the layer, as Figma keeps it for the
 * characters typed later. OpenPencil keeps only some of those fields on a layer.
 */
export function setEmptyTextBinding(
  graph: SceneGraph,
  node: SceneNode,
  field: TextBindableField,
  variable: Variable | null
): void {
  if (!LAYER_TEXT_FIELDS.has(field)) {
    throw new Error(
      `in setBoundVariable: OpenPencil binds ${field} only on text that has characters`
    )
  }
  if (variable) graph.bindVariable(node.id, field, variable.id)
  else graph.unbindVariable(node.id, field)
  reconcileVariableLayouts(graph, { subtrees: [node.id] })
}

const FIGMA_FIELD_BY_DOCUMENT_FIELD = new Map<string, string>(
  Object.entries(NODE_FIELDS)
    .filter(([figma]) => figma !== 'cornerRadius')
    .map(([figma, field]) => [field, figma])
)

/** The variable bound to each paint's colour, by paint index, for `fills` or `strokes`. */
export function paintBindings(node: SceneNode, key: 'fills' | 'strokes'): Map<number, string> {
  const bindings = new Map<number, string>()
  for (const [field, id] of Object.entries(node.boundVariables)) {
    const paint = paintBindingTarget(field)
    if (paint?.list === key) bindings.set(paint.index, id)
  }
  return bindings
}

/**
 * Binds each paint's colour to the variable its `boundVariables.color` names, as Figma does when
 * paints are set, and drops bindings of paints that no longer carry one.
 */
export function setPaintBindings(
  graph: SceneGraph,
  node: SceneNode,
  key: 'fills' | 'strokes',
  paints: readonly FigmaPaint[]
): void {
  const current = paintBindings(node, key)
  const wanted = new Map<number, string>()
  paints.forEach((paint, index) => {
    const id = 'boundVariables' in paint ? paint.boundVariables?.color?.id : undefined
    if (id && graph.variables.get(id)?.type === 'COLOR') wanted.set(index, id)
  })
  for (const index of current.keys()) {
    if (!wanted.has(index)) graph.unbindVariable(node.id, `${key}/${index}/color`)
  }
  for (const [index, id] of wanted) {
    if (current.get(index) !== id) graph.bindVariable(node.id, `${key}/${index}/color`, id)
  }
  if (current.size > 0 || wanted.size > 0) reconcileVariableLayouts(graph, { subtrees: [node.id] })
}

type FigmaBoundVariables = Record<string, FigmaVariableAlias | FigmaVariableAlias[]>

/**
 * A layer's bindings as Figma's `boundVariables` reads them: a reference per node field, a list
 * per text style field and per bound paint.
 */
export function figmaBoundVariables(node: SceneNode): FigmaBoundVariables {
  const result: FigmaBoundVariables = {}
  for (const [field, id] of Object.entries(node.boundVariables)) {
    const name = FIGMA_FIELD_BY_DOCUMENT_FIELD.get(field)
    if (name) result[name] = variableAlias(id)
  }
  // Figma lists a uniform radius by its corners; a file can bind it as one field.
  const radius = node.boundVariables.cornerRadius
  if (radius) for (const corner of CORNER_FIELDS) result[corner] ??= variableAlias(radius)
  if (node.type === 'TEXT') {
    for (const field of TEXT_BINDABLE_FIELDS) {
      const ids = uniq([
        ...(node.boundVariables[field] ? [node.boundVariables[field]] : []),
        ...node.styleRuns.flatMap((run) => {
          const id = run.style.boundVariables?.[field]
          return id ? [id] : []
        })
      ])
      if (ids.length > 0) result[field] = ids.map(variableAlias)
    }
  }
  for (const key of ['fills', 'strokes'] as const) {
    const bindings = paintBindings(node, key)
    if (bindings.size === 0) continue
    result[key] = [...bindings.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, id]) => variableAlias(id))
  }
  return result
}
