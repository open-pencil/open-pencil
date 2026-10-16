import { copyFills, copyStrokes } from '../copy'
import type { SceneGraph } from '../index'
import { hasInstanceOverride } from '../instances'
import type { Color } from '../primitives'
import type { Fill, SceneNode, Stroke, StyleRun, VariableValue } from '../types'
import type { VariableModeFallback } from '../variables'
import { NUMERIC_FIELDS, isNumericVariableBindingField } from './fields'
import { variableValueReferences } from './value'
export { isNumericVariableBindingField } from './fields'

/** New declarations belong to the outermost occurrence, bounded by a component definition. */
export function variableBindingOwner(graph: SceneGraph, node: SceneNode): SceneNode {
  let owner = node
  let current: SceneNode | undefined = node
  while (current) {
    if (current.type === 'COMPONENT' || current.type === 'COMPONENT_SET') break
    if (current.type === 'INSTANCE') owner = current
    current = current.parentId ? graph.getNode(current.parentId) : undefined
  }
  return owner
}

export function assignVariableBindingUnits(
  graph: SceneGraph,
  node: SceneNode,
  field: string
): void {
  if (!isNumericVariableBindingField(field)) return
  const owner = variableBindingOwner(graph, node)
  node.variableBindingScales = {
    ...node.variableBindingScales,
    [field]: owner.variableAssignmentScales[field] ?? 1
  }
}

/**
 * The values a node's numeric bindings resolve to in its mode, in scene units, for the fields
 * whose stored value differs. A width or height an instance overrides keeps its own value.
 */
export function resolvedNumericBindings(
  graph: SceneGraph,
  node: SceneNode,
  fallback: VariableModeFallback = 'active'
): Partial<SceneNode> {
  const updates: Partial<SceneNode> = {}
  for (const [field, variableId] of Object.entries(node.boundVariables)) {
    if (!NUMERIC_FIELDS.has(field)) continue
    if ((field === 'width' || field === 'height') && hasInstanceOverride(graph, node.id, field))
      continue
    const value = graph.resolveNumberVariableForNode(node.id, variableId, fallback)
    if (value === undefined || !Number.isFinite(value)) continue
    const scale = node.variableBindingScales[field] ?? 1
    const effective = value * scale
    if (!Number.isFinite(effective)) continue
    const next = field === 'opacity' ? Math.max(0, Math.min(1, effective)) : effective
    if (node[field as keyof SceneNode] !== next) Object.assign(updates, { [field]: next })
  }
  return updates
}

/**
 * The text a variable bound to text content shows: a string as it is, and a number or boolean
 * as Figma writes it, since Figma lets either be text content.
 */
export function variableText(value: VariableValue | undefined): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'number' && Number.isFinite(value)) return numberText(value)
  return undefined
}

const INT32_MIN = -2_147_483_648
const INT32_MAX = 2_147_483_647

/** How near a whole number a value must be for Figma to write it as one. */
const WHOLE_NUMBER_TOLERANCE = 1e-6

/**
 * A number as Figma desktop 126 writes it as text: one within a millionth of a whole number as
 * that integer, clamped to 32 bits, and anything else with two decimals, its sign kept and an
 * exact tie rounded to even, as C's `%.2f` does (0.125 is "0.12", 0.999 is "1.00", -0.004 is
 * "-0.00").
 */
function numberText(value: number): string {
  const whole = Math.round(value)
  if (Math.abs(value - whole) < WHOLE_NUMBER_TOLERANCE)
    return String(Math.min(INT32_MAX, Math.max(INT32_MIN, whole)) || 0)
  const scaled = Math.abs(value) * 100
  const floor = Math.floor(scaled)
  const tie = scaled - floor === 0.5
  const cents = tie ? floor + (floor % 2) : Math.round(scaled)
  const sign = value < 0 ? '-' : ''
  return `${sign}${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

/**
 * The text and visibility a node's string and boolean bindings resolve to in its mode, for the
 * fields whose stored value differs. Text or visibility an instance overrides, which typing in a
 * layer or toggling its eye records, keeps its own value, as an overridden width or height does.
 * A bound font family is left as stored: changing it needs the font loaded, which resolving a
 * binding cannot do.
 */
export function resolvedValueBindings(
  graph: SceneGraph,
  node: SceneNode,
  fallback: VariableModeFallback = 'active'
): Partial<SceneNode> {
  const updates: Partial<SceneNode> = {}
  const resolve = (field: 'text' | 'visible') => {
    const variableId = node.boundVariables[field]
    if (!variableId || hasInstanceOverride(graph, node.id, field)) return undefined
    return graph.resolveVariableForNode(node.id, variableId, fallback)
  }
  const text = node.type === 'TEXT' ? variableText(resolve('text')) : undefined
  if (text !== undefined && text !== node.text) updates.text = text
  const visible = resolve('visible')
  if (typeof visible === 'boolean' && visible !== node.visible) updates.visible = visible
  return updates
}

/** Fields of a range of characters a bound number gives its value; the rest need fonts loaded. */
const NUMERIC_RUN_FIELDS = ['fontSize', 'fontWeight', 'letterSpacing', 'lineHeight'] as const

/**
 * The runs a text's character bindings resolve to in its mode, when a bound number differs from
 * what its characters hold. Bound font families and styles are left as stored, as the text's own.
 */
export function resolvedRunBindings(
  graph: SceneGraph,
  node: SceneNode,
  fallback: VariableModeFallback = 'active'
): Pick<Partial<SceneNode>, 'styleRuns'> {
  const styleRuns = node.styleRuns.map((run): StyleRun => {
    const bound = run.style.boundVariables
    if (!bound) return run
    let style = run.style
    for (const field of NUMERIC_RUN_FIELDS) {
      const variableId = bound[field]
      if (!variableId) continue
      const value = graph.resolveNumberVariableForNode(node.id, variableId, fallback)
      if (value === undefined || !Number.isFinite(value) || style[field] === value) continue
      style = { ...style, [field]: value }
    }
    return style === run.style ? run : { ...run, style }
  })
  const changed = styleRuns.some((run, index) => run !== node.styleRuns[index])
  return changed ? { styleRuns } : {}
}

/** The variables a node binds, its own and its characters'. */
function boundVariableIds(node: SceneNode): string[] {
  return [
    ...Object.values(node.boundVariables),
    ...node.styleRuns.flatMap((run) => Object.values(run.style.boundVariables ?? {}))
  ].filter((id): id is string => typeof id === 'string')
}

/**
 * A bound paint takes its whole color from the variable, alpha included, the way Figma stores
 * it: the variable's RGB at full alpha, and its alpha as the paint's opacity.
 */
function applyBoundColor(paint: Fill | Stroke, color: Color): void {
  paint.color = { ...color, a: 1 }
  paint.opacity = color.a
}

/** The fills and strokes a node's color bindings resolve to in its mode, when it has any. */
export function resolvedPaintBindings(
  graph: SceneGraph,
  node: SceneNode,
  fallback: VariableModeFallback = 'active'
): Pick<Partial<SceneNode>, 'fills' | 'strokes'> {
  // Most nodes bind nothing, so no copy is made until a paint binding is actually found.
  const changes: Pick<Partial<SceneNode>, 'fills' | 'strokes'> = {}
  for (const field in node.boundVariables) {
    if (!field.endsWith('/color')) continue
    const match = /^(fills|strokes)\/(\d+)\/color$/.exec(field)
    if (!match) continue
    const color = graph.resolveColorVariableForNode(node.id, node.boundVariables[field], fallback)
    const index = Number(match[2])
    if (!color) continue
    if (match[1] === 'fills') {
      if (!node.fills[index]) continue
      changes.fills ??= copyFills(node.fills)
      applyBoundColor(changes.fills[index], color)
    } else {
      if (!node.strokes[index]) continue
      changes.strokes ??= copyStrokes(node.strokes)
      applyBoundColor(changes.strokes[index], color)
    }
  }
  return changes
}

/**
 * The layers a reconcile looks at: those bound to these variables, directly or through a variable
 * aliasing them, or the layers in these subtrees. Without a scope, every layer.
 */
export type BindingScope = { variables: Iterable<string> } | { subtrees: Iterable<string> }

/** These variables and every variable that aliases one of them, at any depth and in any mode. */
export function variablesResolvingThrough(graph: SceneGraph, ids: Iterable<string>): Set<string> {
  const found = new Set(ids)
  let grew = true
  while (grew) {
    grew = false
    for (const variable of graph.variables.values()) {
      if (found.has(variable.id)) continue
      const aliases = Object.values(variable.valuesByMode).some((value) =>
        variableValueReferences(value).some((id) => found.has(id))
      )
      if (aliases) {
        found.add(variable.id)
        grew = true
      }
    }
  }
  return found
}

function subtreeNodes(graph: SceneGraph, roots: Iterable<string>): SceneNode[] {
  const nodes: SceneNode[] = []
  const pending = [...roots]
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    const node = graph.getNode(id)
    if (!node) continue
    nodes.push(node)
    pending.push(...node.childIds)
  }
  return nodes
}

/**
 * The collections whose variables the layers in these subtrees resolve: those they bind, and
 * those the bound variables alias, so a mode set on the subtrees can change what they show.
 */
export function collectionsBoundIn(graph: SceneGraph, roots: Iterable<string>): Set<string> {
  const pending = subtreeNodes(graph, roots).flatMap(boundVariableIds)
  const seen = new Set<string>()
  const collections = new Set<string>()
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    if (seen.has(id)) continue
    seen.add(id)
    const variable = graph.variables.get(id)
    if (!variable) continue
    collections.add(variable.collectionId)
    for (const value of Object.values(variable.valuesByMode))
      pending.push(...variableValueReferences(value))
  }
  return collections
}

/**
 * The layers a change to these variables reaches: those binding one of them, or a variable that
 * aliases one, on the layer itself or on its characters.
 */
export function layersUsingVariables(graph: SceneGraph, ids: Iterable<string>): SceneNode[] {
  const variables = variablesResolvingThrough(graph, ids)
  return [...graph.getAllNodes()].filter((node) =>
    boundVariableIds(node).some((id) => variables.has(id))
  )
}

function scopedNodes(graph: SceneGraph, scope: BindingScope | undefined): Iterable<SceneNode> {
  if (!scope) return graph.getAllNodes()
  if ('subtrees' in scope) return subtreeNodes(graph, scope.subtrees)
  return layersUsingVariables(graph, scope.variables)
}

/**
 * Resolve live numeric, text, and visibility bindings, numbers in scene units, without authoring
 * instance overrides. A scope limits it to the layers a change can reach, so layers whose saved
 * values differ from their bindings elsewhere in the document are left as saved.
 */
export function reconcileVariableBindings(graph: SceneGraph, scope?: BindingScope): string[] {
  const changed: string[] = []
  for (const node of scopedNodes(graph, scope)) {
    const updates = {
      ...resolvedNumericBindings(graph, node),
      ...resolvedValueBindings(graph, node),
      ...resolvedRunBindings(graph, node)
    }
    if (Object.keys(updates).length === 0) continue
    graph.updateNode(node.id, updates)
    changed.push(node.id)
  }
  return changed
}
