import { uniq } from 'es-toolkit/array'
import { pick } from 'es-toolkit/object'
import { isEmptyObject, isEqual } from 'es-toolkit/predicate'

import type { SceneGraph } from '../graph'
import { hasInstanceOverride } from '../instances/overrides'
import type { Color } from '../primitives'
import { isTextStyleLength, scaledTextStyleLengths } from '../scaling/node'
import { pixelLength } from '../text/lengths'
import type { CharacterStyleOverride, Effect, SceneNode, StyleRun, TextLength } from '../types'
import {
  effectBindableProperties,
  effectBindingTarget,
  NUMERIC_FIELDS,
  isNumericVariableBindingField,
  type EffectBindingProperty
} from './fields'
import { refreshBoundPaints } from './paints'
import { collectionsResolving } from './resolution'
import {
  createStyleBindingLookup,
  effectiveBoundVariables,
  effectiveRunBoundVariables,
  inheritedRunStyleBindings,
  inheritedTextStyleBindings,
  layerBindingsInEffect,
  textStyleConsumers,
  type TextStyleLookup,
  type VariableBindings
} from './style-bindings'
import { subtreeNodes } from './subtree'
import { variableText, variableTruthy } from './text'
import { variableValueReferences } from './value'
export {
  EFFECT_BINDING_PROPERTIES,
  effectBindableProperties,
  effectBindingField,
  effectBindingTarget,
  effectBindingVariableType,
  isNumericVariableBindingField,
  paintBindingTarget,
  type EffectBindingProperty,
  TEXT_CONTENT_VARIABLE_TYPES,
  VISIBILITY_VARIABLE_TYPES,
  type PaintBindingList
} from './fields'

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

/** Fields a bound number sets as a length in pixels, as Figma's do, whatever unit they held. */
const TEXT_LENGTH_FIELDS: ReadonlySet<string> = new Set(['lineHeight', 'letterSpacing'])

/** Whether the instance a layer sits in, or the instance itself, overrides one of its fields. */
function overriddenInInstance(graph: SceneGraph, nodeId: string, field: string): boolean {
  const instance = graph.closest(nodeId, (node) => node.type === 'INSTANCE')
  return !!instance && hasInstanceOverride(instance.instanceOverrides, instance.id, nodeId, field)
}

function lengthScale(field: string, componentScale: number): number {
  return isTextStyleLength(field) ? componentScale : 1
}

/** A style's lengths take the occurrence's scale; the layer's own keep the scale they recorded. */
function bindingScale(node: SceneNode, field: string, styleBound: VariableBindings): number {
  if (field in styleBound) {
    return lengthScale(field, node.componentScale)
  }
  return node.variableBindingScales[field] ?? 1
}

/** Fields of a range of characters a bound number gives its value; the rest need fonts loaded. */
const NUMERIC_RUN_FIELDS = ['fontSize', 'fontWeight', 'letterSpacing', 'lineHeight'] as const
const NUMERIC_TEXT_FIELDS: ReadonlySet<string> = new Set(NUMERIC_RUN_FIELDS)

export function resolvesToNumber(field: string): boolean {
  return NUMERIC_FIELDS.has(field) || NUMERIC_TEXT_FIELDS.has(field)
}

/** A bound number as the field stores it. */
export function boundNumberValue(field: string, value: number): number | TextLength {
  return TEXT_LENGTH_FIELDS.has(field) ? pixelLength(value) : value
}

/**
 * The values a node's numeric bindings resolve to in its mode, in scene units, for the fields
 * whose stored value differs. A width or height an instance overrides keeps its own value.
 */
export function resolvedNumericBindings(
  graph: SceneGraph,
  node: SceneNode,
  styles: TextStyleLookup = createStyleBindingLookup(graph)
): Partial<SceneNode> {
  const styleBound = inheritedTextStyleBindings(node, styles)
  return resolvedNumbers(graph, node, effectiveBoundVariables(node, styles), styleBound)
}

function resolvedNumbers(
  graph: SceneGraph,
  node: SceneNode,
  bindings: VariableBindings,
  styleBound: VariableBindings
): Partial<SceneNode> {
  const updates: Partial<SceneNode> = {}
  for (const [field, variableId] of Object.entries(bindings)) {
    if (!resolvesToNumber(field)) continue
    if ((field === 'width' || field === 'height') && overriddenInInstance(graph, node.id, field))
      continue
    const value = graph.resolveNumberVariableForNode(node.id, variableId)
    if (value === undefined || !Number.isFinite(value)) continue
    const effective = value * bindingScale(node, field, styleBound)
    if (!Number.isFinite(effective)) continue
    const next = boundNumberValue(
      field,
      field === 'opacity' ? Math.max(0, Math.min(1, effective)) : effective
    )
    if (!isEqual(node[field as keyof SceneNode], next)) Object.assign(updates, { [field]: next })
  }
  return updates
}

/**
 * The text and visibility a node's string and boolean bindings resolve to in its mode, for the
 * fields whose stored value differs. Text or visibility an instance overrides, which typing in a
 * layer or toggling its eye records, keeps its own value, as an overridden width or height does.
 * A bound font family is left as stored: changing it needs the font loaded, which resolving a
 * binding cannot do.
 */
export function resolvedValueBindings(graph: SceneGraph, node: SceneNode): Partial<SceneNode> {
  const updates: Partial<SceneNode> = {}
  const resolve = (field: 'text' | 'visible') => {
    const variableId = node.boundVariables[field]
    if (!variableId || overriddenInInstance(graph, node.id, field)) return undefined
    return graph.resolveVariableForNode(node.id, variableId)
  }
  const text = node.type === 'TEXT' ? variableText(resolve('text')) : undefined
  if (text !== undefined && text !== node.text) updates.text = text
  // Figma binds visibility to text too, and shows the layer when the text reads as true.
  const visible = variableTruthy(resolve('visible'))
  if (visible !== undefined && visible !== node.visible) updates.visible = visible
  return updates
}

type RunHolder = Pick<SceneNode, 'id' | 'styleRuns' | 'componentScale'>

/**
 * The runs a text's character bindings resolve to in its mode, when a bound number differs from
 * what its characters hold. Bound font families and styles are left as stored, as the text's own.
 */
export function resolvedRunBindings(
  graph: SceneGraph,
  node: RunHolder,
  styles: TextStyleLookup = createStyleBindingLookup(graph)
): Pick<Partial<SceneNode>, 'styleRuns'> {
  return resolvedRuns(graph, node, (run) => effectiveRunBoundVariables(run, styles))
}

function resolvedRuns(
  graph: SceneGraph,
  node: RunHolder,
  runBindings: (run: StyleRun) => VariableBindings
): Pick<Partial<SceneNode>, 'styleRuns'> {
  const styleRuns = node.styleRuns.map((run): StyleRun => {
    const bound = runBindings(run)
    let style = run.style
    for (const field of NUMERIC_RUN_FIELDS) {
      const variableId = bound[field]
      if (!variableId) continue
      const value = graph.resolveNumberVariableForNode(node.id, variableId)
      if (value === undefined || !Number.isFinite(value)) continue
      const next = boundNumberValue(field, value * lengthScale(field, node.componentScale))
      if (isEqual(style[field], next)) continue
      style = { ...style, [field]: next }
    }
    return style === run.style ? run : { ...run, style }
  })
  const changed = styleRuns.some((run, index) => run !== node.styleRuns[index])
  return changed ? { styleRuns } : {}
}

export function resolvedTextStyleBindings(
  graph: SceneGraph,
  node: SceneNode,
  styles: TextStyleLookup
): Partial<SceneNode> {
  if (node.type !== 'TEXT') {
    return {}
  }
  const styleBound = inheritedTextStyleBindings(node, styles)
  return {
    ...resolvedNumbers(graph, node, styleBound, styleBound),
    ...resolvedRuns(graph, node, (run) => inheritedRunStyleBindings(run, styles))
  }
}

/** The variables a node binds: its own, its characters' and those its text styles bind. */
function boundVariableIds(node: SceneNode, styles: TextStyleLookup): string[] {
  return [
    ...Object.values(effectiveBoundVariables(node, styles)),
    ...node.styleRuns.flatMap((run) => Object.values(effectiveRunBoundVariables(run, styles)))
  ].filter((id): id is string => typeof id === 'string')
}

/** `effect` with one bound property set to its variable's value; a colour keeps its alpha. */
function withBoundEffectValue(
  effect: Effect,
  property: EffectBindingProperty,
  value: number | Color
): Effect {
  if (typeof value !== 'number') return property === 'color' ? { ...effect, color: value } : effect
  if (property === 'offsetX') return { ...effect, offset: { ...effect.offset, x: value } }
  if (property === 'offsetY') return { ...effect, offset: { ...effect.offset, y: value } }
  if (property === 'radius' || property === 'spread') return { ...effect, [property]: value }
  return effect
}

/** A bound effect length in an occurrence's coordinates, which are 1:1 outside instances. */
function scaledLength(length: number | undefined, node: SceneNode): number | undefined {
  return length === undefined ? undefined : length * node.componentScale
}

/**
 * The effects a node's effect bindings resolve to in its mode, when one differs from what the node
 * holds. Lengths stay as the variables give them, negative ones included, as Figma keeps them;
 * drawing treats a negative blur as none. In an instance they take its scale against its
 * component, whenever they were bound, as Figma scales them; a layer scaled outside an instance
 * goes back to the variable's own value.
 */
export function resolvedEffectBindings(
  graph: SceneGraph,
  node: SceneNode
): Pick<Partial<SceneNode>, 'effects'> {
  // Most nodes bind nothing, so no copy is made until a value actually changes.
  let effects: Effect[] | undefined
  for (const [field, variableId] of Object.entries(node.boundVariables)) {
    const target = effectBindingTarget(field)
    if (!target) continue
    const effect = (effects ?? node.effects).at(target.index)
    if (!effect || !effectBindableProperties(effect.type).includes(target.property)) continue
    const value =
      target.property === 'color'
        ? graph.resolveColorVariableForNode(node.id, variableId)
        : scaledLength(graph.resolveNumberVariableForNode(node.id, variableId), node)
    if (value == null || (typeof value === 'number' && !Number.isFinite(value))) continue
    const next = withBoundEffectValue(effect, target.property, value)
    if (isEqual(next, effect)) continue
    effects ??= [...node.effects]
    effects[target.index] = next
  }
  return effects ? { effects } : {}
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

/**
 * The collections whose variables the layers in these subtrees resolve: those they bind, and
 * those the bound variables alias, so a mode set on the subtrees can change what they show.
 */
export function collectionsBoundIn(graph: SceneGraph, roots: Iterable<string>): Set<string> {
  const styles = createStyleBindingLookup(graph)
  return collectionsResolving(
    graph,
    subtreeNodes(graph, roots).flatMap((node) => boundVariableIds(node, styles))
  )
}

/**
 * The layers a change to these variables reaches: those binding one of them, or a variable that
 * aliases one, on the layer itself or on its characters.
 */
export function layersUsingVariables(
  graph: SceneGraph,
  ids: Iterable<string>,
  styles: TextStyleLookup = createStyleBindingLookup(graph)
): SceneNode[] {
  const variables = variablesResolvingThrough(graph, ids)
  return [...graph.getAllNodes()].filter((node) =>
    boundVariableIds(node, styles).some((id) => variables.has(id))
  )
}

/**
 * The layers in these subtrees that resolve a variable of these collections, binding it or a
 * variable that aliases it, so a mode change for the collections can change what they show.
 */
export function layersResolvingCollections(
  graph: SceneGraph,
  roots: Iterable<string>,
  collectionIds: ReadonlySet<string>
): SceneNode[] {
  const inCollections = [...graph.variables.values()].filter((variable) =>
    collectionIds.has(variable.collectionId)
  )
  const variables = variablesResolvingThrough(
    graph,
    inCollections.map((variable) => variable.id)
  )
  const styles = createStyleBindingLookup(graph)
  return subtreeNodes(graph, roots).filter((node) =>
    boundVariableIds(node, styles).some((id) => variables.has(id))
  )
}

interface ScopedLayers {
  nodes: Iterable<SceneNode>
  restyled: ReadonlySet<string>
}

const NO_RESTYLED: ReadonlySet<string> = new Set()

function scopedLayers(
  graph: SceneGraph,
  scope: BindingScope | undefined,
  styles: TextStyleLookup
): ScopedLayers {
  if (!scope) {
    return { nodes: graph.getAllNodes(), restyled: NO_RESTYLED }
  }
  if ('subtrees' in scope) {
    return withTextStyleConsumers(graph, subtreeNodes(graph, scope.subtrees))
  }
  return { nodes: layersUsingVariables(graph, scope.variables, styles), restyled: NO_RESTYLED }
}

function withTextStyleConsumers(graph: SceneGraph, nodes: SceneNode[]): ScopedLayers {
  const styleIds = new Set<string>()
  for (const node of nodes) {
    if (node.sharedStyleType === 'TEXT' && node.source.id) {
      styleIds.add(node.source.id)
    }
  }
  if (styleIds.size === 0) {
    return { nodes, restyled: NO_RESTYLED }
  }
  return { nodes: uniq([...nodes, ...textStyleConsumers(graph, styleIds)]), restyled: styleIds }
}

type NumericTextValues = Pick<CharacterStyleOverride, (typeof NUMERIC_RUN_FIELDS)[number]>

function unboundStyleValues(
  styleValues: NumericTextValues,
  current: NumericTextValues,
  bound: VariableBindings
): NumericTextValues | undefined {
  let values: NumericTextValues | undefined
  for (const field of NUMERIC_RUN_FIELDS) {
    if (!(field in bound) && !isEqual(current[field], styleValues[field])) {
      values = { ...values, [field]: styleValues[field] }
    }
  }
  return values
}

function restyledValues(
  graph: SceneGraph,
  node: SceneNode,
  styleId: string | null | undefined,
  current: NumericTextValues,
  bound: VariableBindings,
  restyled: ReadonlySet<string>
): NumericTextValues | undefined {
  if (!styleId || !restyled.has(styleId)) {
    return undefined
  }
  const style = graph.getSharedStyleNode(styleId, 'TEXT')
  if (!style) {
    return undefined
  }
  const styleValues = scaledTextStyleLengths(pick(style, NUMERIC_RUN_FIELDS), node.componentScale)
  return unboundStyleValues(styleValues, current, bound)
}

function restyledRuns(
  graph: SceneGraph,
  node: SceneNode,
  restyled: ReadonlySet<string>,
  styles: TextStyleLookup
): Pick<Partial<SceneNode>, 'styleRuns'> {
  const styleRuns = node.styleRuns.map((run): StyleRun => {
    const bound = effectiveRunBoundVariables(run, styles)
    const values = restyledValues(graph, node, run.style.textStyleId, run.style, bound, restyled)
    return values ? { ...run, style: { ...run.style, ...values } } : run
  })
  const changed = styleRuns.some((run, index) => run !== node.styleRuns[index])
  return changed ? { styleRuns } : {}
}

function styleOwnValues(
  graph: SceneGraph,
  node: SceneNode,
  restyled: ReadonlySet<string>,
  styles: TextStyleLookup
): Partial<SceneNode> {
  if (restyled.size === 0) {
    return {}
  }
  const bound = effectiveBoundVariables(node, styles)
  return {
    ...restyledValues(graph, node, node.textStyleId, node, bound, restyled),
    ...restyledRuns(graph, node, restyled, styles)
  }
}

function runReadsVariables({ style }: StyleRun): boolean {
  return (
    Boolean(style.textStyleId) ||
    (style.boundVariables !== undefined && !isEmptyObject(style.boundVariables))
  )
}

function readsVariables(node: SceneNode): boolean {
  return (
    !isEmptyObject(node.boundVariables) ||
    Boolean(node.textStyleId) ||
    node.styleRuns.some(runReadsVariables)
  )
}

function resolvedOwnBindings(
  graph: SceneGraph,
  node: SceneNode,
  styleBound: VariableBindings,
  styles: TextStyleLookup
): Partial<SceneNode> {
  const own = layerBindingsInEffect(node, styles)
  return {
    ...resolvedNumbers(graph, node, own, styleBound),
    ...resolvedValueBindings(graph, node),
    ...resolvedRunBindings(graph, node, styles)
  }
}

/**
 * Resolve live numeric, text, visibility, and effect bindings, numbers in scene units, and refresh
 * bound paints whose variable's color for the layer changed (`refreshBoundPaints`), without
 * authoring instance overrides. A scope limits it to the layers a change can reach, so layers whose
 * saved values differ from their bindings elsewhere in the document are left as saved. Returns the
 * layers whose change needs a layout pass; effects and paints are not a layout input, so a change
 * to them alone is written but not returned.
 */
export function reconcileVariableBindings(graph: SceneGraph, scope?: BindingScope): string[] {
  return [...reconcileVariableBindingUpdates(graph, scope).keys()]
}

/**
 * As `reconcileVariableBindings`, with the layout fields each relaid layer received. Effects and
 * paints are written too, but draw without layout, so a layer whose only change is one is left out.
 */
export function reconcileVariableBindingUpdates(
  graph: SceneGraph,
  scope?: BindingScope
): Map<string, Partial<SceneNode>> {
  const relaid = new Map<string, Partial<SceneNode>>()
  const styles = createStyleBindingLookup(graph)
  const { nodes: scoped, restyled } = scopedLayers(graph, scope, styles)
  const nodes = [...scoped]
  for (const node of nodes) refreshBoundPaints(graph, node)
  for (const node of nodes) {
    if (!readsVariables(node)) {
      continue
    }
    const unbound = styleOwnValues(graph, node, restyled, styles)
    if (!isEmptyObject(unbound)) {
      graph.updateNode(node.id, unbound)
    }
    const styleBound = inheritedTextStyleBindings(node, styles)
    const resolved = {
      ...resolvedNumbers(graph, node, styleBound, styleBound),
      ...resolvedOwnBindings(graph, node, styleBound, styles)
    }
    const updates = { ...resolved, ...resolvedEffectBindings(graph, node) }
    if (!isEmptyObject(updates)) {
      graph.updateNode(node.id, updates)
    }
    const layoutUpdates = { ...unbound, ...resolved }
    if (!isEmptyObject(layoutUpdates)) {
      relaid.set(node.id, layoutUpdates)
    }
  }
  return relaid
}

/** A layer list whose items carry their own bindings, keyed by position such as `fills/1/color`. */
export type BoundLayerList = 'fills' | 'strokes' | 'effects'

/**
 * `boundVariables` once the `list` items are rebuilt from `sources`, where `sources[i]` is the
 * position the new item `i` had before, or null for an added item. A binding moves with its item
 * and goes with a removed one, as Figma keeps a binding on its paint or effect.
 */
export function listBindingsAfterEdit(
  boundVariables: Readonly<Record<string, string>>,
  list: BoundLayerList,
  sources: readonly (number | null)[]
): Record<string, string> {
  const prefix = `${list}/`
  const moved: Record<string, string> = {}
  for (const [field, variableId] of Object.entries(boundVariables)) {
    if (!field.startsWith(prefix)) {
      moved[field] = variableId
      continue
    }
    const [index, ...property] = field.slice(prefix.length).split('/')
    const next = sources.indexOf(Number(index))
    if (next !== -1 && property.length > 0)
      moved[`${prefix}${next}/${property.join('/')}`] = variableId
  }
  return moved
}
