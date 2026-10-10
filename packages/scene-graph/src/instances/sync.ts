// Building and synchronizing the copies an instance shows, shared by creation, swap, and sync.
import { isEqual } from 'es-toolkit/predicate'

import type { ComponentPropertyReferenceField, SceneGraph, SceneNode } from '../'
import { cloneNodeProps, copyEffects, copyFills, copyStrokes, copyStyleRuns } from '../copy'
import type { NodeCloneMode } from '../copy'
import {
  createInstanceOverrideState,
  getInstanceOverride,
  instanceOverridesAt
} from '../instance-overrides'
import { scaleNodeChanges } from '../scaling/node'
import { ownsSlotContent, slotPropertyId } from '../slots/frames'
import { scaleVariableBindingUnits } from '../variables/units'
import { instanceLayerSource, isSwappedAt } from './addressing'
import { INSTANCE_SYNC_FIELDS } from './fields'
import {
  copyLayerId,
  instanceScope,
  isInstanceLayerId,
  parseInstanceLayerId,
  type InstanceScope
} from './layer-ids'
import { appliedOverrideValue } from './override-values'

function setSceneProp<K extends keyof SceneNode>(
  target: Partial<SceneNode>,
  key: K,
  value: SceneNode[K]
): void {
  target[key] = value
}

export function copyProp(
  target: Partial<SceneNode> | SceneNode,
  source: SceneNode,
  key: keyof SceneNode
): void {
  if (key === 'fills') {
    setSceneProp(target, key, copyFills(source.fills))
  } else if (key === 'strokes') {
    setSceneProp(target, key, copyStrokes(source.strokes))
  } else if (key === 'effects') {
    setSceneProp(target, key, copyEffects(source.effects))
  } else if (key === 'styleRuns') {
    setSceneProp(target, key, copyStyleRuns(source.styleRuns))
  } else if (key === 'boundVariables') {
    // Shallow copy the binding map — values are variable IDs (strings), not objects
    setSceneProp(target, key, { ...source.boundVariables })
    setSceneProp(target, 'variableBindingScales', { ...source.variableBindingScales })
  } else if (key === 'variableModes') {
    setSceneProp(target, key, { ...source.variableModes })
  } else if (key === 'gridPosition') {
    // Shallow copy the grid position object — all fields are primitives
    setSceneProp(target, key, source.gridPosition ? { ...source.gridPosition } : null)
  } else {
    const value = source[key]
    setSceneProp(target, key, Array.isArray(value) ? structuredClone(value) : value)
  }
}

/**
 * Whether sync leaves a field alone. A binding override of one field protects that field's
 * binding; overriding `boundVariables` as a whole protects them all unless per-field entries say
 * which.
 */
export function bindingProtection(
  overridden: ReadonlySet<string> | Iterable<string>
): (field: string) => boolean {
  const scope = [...overridden]
  const perField = scope.some((field) => field.startsWith('boundVariables/'))
  const fields = new Set(scope.filter((field) => field !== 'boundVariables' || !perField))
  return (field) => fields.has(field)
}

export function syncBindingFields(
  target: SceneNode,
  source: SceneNode,
  updates: Partial<SceneNode>,
  protectedField: (field: string) => boolean
): void {
  if (protectedField('boundVariables')) return
  const bindings = { ...source.boundVariables }
  const scales = { ...source.variableBindingScales }
  for (const field of new Set([
    ...Object.keys(source.boundVariables),
    ...Object.keys(target.boundVariables),
    ...Object.keys(target.variableBindingScales)
  ])) {
    if (!protectedField(`boundVariables/${field}`)) continue
    if (!Object.hasOwn(target.boundVariables, field)) Reflect.deleteProperty(bindings, field)
    else bindings[field] = target.boundVariables[field]
    if (target.variableBindingScales[field] === undefined) Reflect.deleteProperty(scales, field)
    else scales[field] = target.variableBindingScales[field]
  }
  updates.boundVariables = bindings
  updates.variableBindingScales = scales
}

export function isProtectedSyncField(
  node: SceneNode,
  key: string,
  protectedField: (field: string) => boolean
): boolean {
  return (
    protectedField(key) ||
    (key in node.boundVariables &&
      (protectedField('boundVariables') || protectedField(`boundVariables/${key}`)))
  )
}

export function sourceInTargetCoordinates(source: SceneNode, targetScale: number): SceneNode {
  const factor = targetScale / source.componentScale
  if (!Number.isFinite(factor) || factor <= 0) throw new Error('Invalid component coordinate scale')
  if (factor === 1) return source
  return {
    ...source,
    ...scaleNodeChanges(source, factor, true),
    ...scaleVariableBindingUnits(source, factor)
  }
}

export function updateSyncedProps(
  graph: SceneGraph,
  target: SceneNode,
  updates: Partial<SceneNode>
): void {
  const changed = Object.fromEntries(
    Object.entries(updates).filter(
      ([key, value]) => !isEqual(target[key as keyof SceneNode], value)
    )
  ) as Partial<SceneNode>
  if (Object.keys(changed).length) graph.updateNode(target.id, changed)
}

/**
 * Size follows from layout and constraints once a layer is placed, so a synced copy keeps the
 * size it has; a new copy starts from the recorded one.
 */
const PLACED_FIELDS: ReadonlySet<string> = new Set(['width', 'height'])

/**
 * Whether sync writes the recorded value of an overridden field. A bound field shows what its
 * variable resolves to.
 */
function showsOverrideValue(
  copy: SceneNode,
  field: keyof SceneNode,
  overridden: ReadonlyMap<string, unknown>
): boolean {
  return overridden.has(field) && !PLACED_FIELDS.has(field) && !(field in copy.boundVariables)
}

/** The owner a scope records overrides on, and the path of a copy in it. */
interface CopyContext {
  readonly scope: InstanceScope
  readonly owner: SceneNode
}

function pathOf(copyId: string): readonly string[] {
  const address = parseInstanceLayerId(copyId)
  if (!address) throw new Error(`Not an instance layer: ${copyId}`)
  return address.path
}

/** The component an instance copy shows: its own when swapped, its component layer's otherwise. */
function shownComponentId(context: CopyContext, copyId: string, source: SceneNode): string | null {
  const swapped = getInstanceOverride(
    context.owner.instanceOverrides,
    pathOf(copyId),
    'componentId'
  )
  return typeof swapped === 'string' ? swapped : source.componentId
}

function cloneCopy(
  graph: SceneGraph,
  context: CopyContext,
  source: SceneNode,
  sourceParent: SceneNode,
  targetParent: SceneNode,
  mode: NodeCloneMode
): SceneNode {
  const id = copyLayerId(context.scope, source)
  // A copy is named by what it copies, so one built before is the copy itself.
  const existing = graph.getNode(id)
  if (existing) return existing
  const componentScale =
    (source.componentScale * targetParent.componentScale) / sourceParent.componentScale
  const props = cloneNodeProps(sourceInTargetCoordinates(source, componentScale), null, mode)
  // A layer the instance overrode, such as one a swap carried its overrides to, shows them.
  const overridden = instanceOverridesAt(context.owner.instanceOverrides, pathOf(id))
  for (const key of INSTANCE_SYNC_FIELDS)
    if (key !== 'boundVariables' && overridden.has(key) && !(key in source.boundVariables))
      setSceneProp(props, key, appliedOverrideValue(key, overridden.get(key), componentScale))
  return graph.createNodeWithId(id, source.type, targetParent.id, {
    ...props,
    componentId: source.type === 'INSTANCE' ? shownComponentId(context, id, source) : null,
    // A copy records no overrides; the outermost instance holds them for every layer inside it.
    instanceOverrides: createInstanceOverrideState(),
    componentScale
  })
}

function isSwapped(context: CopyContext, copy: SceneNode): boolean {
  return copy.type === 'INSTANCE' && isSwappedAt(context.owner, pathOf(copy.id))
}

/** Where the contents of an instance copy come from: its swapped component, or its source layer. */
function contentsSource(
  graph: SceneGraph,
  context: CopyContext,
  copy: SceneNode,
  source: SceneNode
): { source: SceneNode; context: CopyContext } | undefined {
  if (!isSwapped(context, copy)) return { source, context }
  const component = copy.componentId ? graph.getNode(copy.componentId) : undefined
  return component
    ? { source: component, context: { ...context, scope: instanceScope(copy) } }
    : undefined
}

function cloneCopies(
  graph: SceneGraph,
  context: CopyContext,
  sourceParent: SceneNode,
  targetParent: SceneNode,
  mode: NodeCloneMode
): void {
  // A component that contains itself, directly or through a cycle of instances, would recurse
  // without end; such a layer is left without copies.
  if (sourceParent.id === targetParent.id || graph.isDescendant(targetParent.id, sourceParent.id))
    return
  for (const childId of sourceParent.childIds) {
    const source = graph.getNode(childId)
    if (!source) continue
    const copy = cloneCopy(graph, context, source, sourceParent, targetParent, mode)
    const contents = contentsSource(graph, context, copy, source)
    if (contents && contents.source.childIds.length > 0)
      cloneCopies(graph, contents.context, contents.source, copy, mode)
  }
}

/** Builds the copies `instance` shows of `component`, under their ids. */
export function cloneInstanceChildren(
  graph: SceneGraph,
  instance: SceneNode,
  component: SceneNode,
  mode: NodeCloneMode = 'deep'
): void {
  const scope = instanceScope(instance)
  const owner = graph.getNode(scope.owner)
  if (!owner) throw new Error(`Missing instance ${scope.owner}`)
  cloneCopies(graph, { scope, owner }, component, instance, mode)
  for (const copy of graph.getChildren(instance.id)) applyEnclosingAssignments(graph, copy)
}

/** SLOT_CONTENT is absent because it drives children, which `ownsSlotContent` keeps instead. */
const PROPERTY_REFERENCE_FIELDS: Partial<Record<ComponentPropertyReferenceField, string>> = {
  VISIBLE: 'visible',
  TEXT: 'text',
  INSTANCE_SWAP: 'componentId'
}

/**
 * Whether this instance's component, or the set it is a variant of, is where `propertyId` is
 * defined. Only a set counts: a component nested in an ordinary component defines its own
 * properties, not the outer one's.
 */
function definesProperty(graph: SceneGraph, instance: SceneNode, propertyId: string): boolean {
  const component = instance.componentId ? graph.nodes.get(instance.componentId) : undefined
  const parent = component?.parentId ? graph.nodes.get(component.parentId) : undefined
  const set = parent?.type === 'COMPONENT_SET' ? parent : undefined
  return [component, set]
    .flatMap((node) => node?.componentPropertyDefinitions ?? [])
    .some((definition) => definition.id === propertyId)
}

/**
 * What the nearest enclosing instance assigns `propertyId`, if any does. A property id belongs
 * to the component that defines it, so the walk stops at an instance of that component even
 * when it assigns nothing; otherwise an outer instance's unrelated property of the same id wins.
 */
function enclosingAssignment(
  graph: SceneGraph,
  node: SceneNode,
  propertyId: string
): string | undefined {
  let current: SceneNode | undefined = node
  while (current) {
    if (current.type === 'INSTANCE') {
      if (Object.hasOwn(current.componentPropertyAssignments, propertyId))
        return current.componentPropertyAssignments[propertyId]
      if (definesProperty(graph, current, propertyId)) return undefined
    }
    current = current.parentId ? graph.nodes.get(current.parentId) : undefined
  }
  return undefined
}

function hasEnclosingAssignment(graph: SceneGraph, node: SceneNode, propertyId: string): boolean {
  return enclosingAssignment(graph, node, propertyId) !== undefined
}

/**
 * A component can gain a property-driven layer after an instance of it exists. Sync leaves a
 * driven field alone, so a fresh copy has to take the enclosing instance's assignment here or
 * it keeps the component's default while every other instance layer shows the assigned value.
 */
function applyEnclosingAssignments(graph: SceneGraph, node: SceneNode): void {
  for (const reference of node.componentPropertyReferences) {
    const field = PROPERTY_REFERENCE_FIELDS[reference.field]
    if (!field) continue
    const value = enclosingAssignment(graph, node, reference.propertyId)
    if (value === undefined) continue
    if (field === 'visible') graph.updateNode(node.id, { visible: value === 'true' })
    else if (field === 'text') graph.updateNode(node.id, { text: value })
    else if (field === 'componentId' && node.type === 'INSTANCE' && graph.nodes.has(value)) {
      graph.swapInstanceComponent(node.id, value)
    }
  }
  for (const child of graph.getChildren(node.id)) applyEnclosingAssignments(graph, child)
}

/**
 * Fields a component property drives on this copy. The component states the default, but
 * an enclosing instance's assignment decides the value, so synchronising must not copy the
 * default over it — a page loaded later would otherwise reset the instance to the default.
 */
function propertyDrivenFields(graph: SceneGraph, copy: SceneNode, source: SceneNode): Set<string> {
  const driven = new Set<string>()
  for (const reference of source.componentPropertyReferences) {
    const field = PROPERTY_REFERENCE_FIELDS[reference.field]
    if (field && hasEnclosingAssignment(graph, copy, reference.propertyId)) driven.add(field)
  }
  return driven
}

/**
 * The text and visibility enclosing assignments give an existing copy whose layer a property
 * drives. A layer linked to a property after the instance was made would otherwise keep what it
 * showed before, since synchronising leaves driven fields alone.
 */
function assignedFieldValues(
  graph: SceneGraph,
  copy: SceneNode,
  source: SceneNode
): Partial<SceneNode> {
  const values: Partial<SceneNode> = {}
  for (const reference of source.componentPropertyReferences) {
    const value = enclosingAssignment(graph, copy, reference.propertyId)
    if (value === undefined) continue
    if (reference.field === 'TEXT' && copy.type === 'TEXT') values.text = value
    else if (reference.field === 'VISIBLE') values.visible = value === 'true'
  }
  return values
}

function syncCopy(
  graph: SceneGraph,
  context: CopyContext,
  source: SceneNode,
  copy: SceneNode,
  sourceParent: SceneNode,
  targetParent: SceneNode
): void {
  const overridden = instanceOverridesAt(context.owner.instanceOverrides, pathOf(copy.id))
  const protectedField = bindingProtection(overridden.keys())
  const driven = propertyDrivenFields(graph, copy, source)
  const componentScale =
    (source.componentScale * targetParent.componentScale) / sourceParent.componentScale
  const scaled = sourceInTargetCoordinates(source, componentScale)
  // Which properties a layer serves is the component's to say; a slot or exposed layer
  // created on the component becomes one in every instance.
  const updates: Partial<SceneNode> = {
    componentScale,
    componentPropertyReferences: structuredClone(source.componentPropertyReferences)
  }
  if (copy.type === 'INSTANCE') updates.componentId = shownComponentId(context, copy.id, source)
  syncBindingFields(copy, scaled, updates, protectedField)
  for (const key of INSTANCE_SYNC_FIELDS) {
    if (key === 'boundVariables') continue
    if (driven.has(key)) continue
    if (isProtectedSyncField(copy, key, protectedField)) {
      if (showsOverrideValue(copy, key, overridden))
        setSceneProp(updates, key, appliedOverrideValue(key, overridden.get(key), componentScale))
      continue
    }
    copyProp(updates, scaled, key)
  }
  Object.assign(updates, assignedFieldValues(graph, copy, source))
  updateSyncedProps(graph, copy, updates)
}

/** Puts the copies in their component layers' order; layers of the instance's own go last. */
function orderChildren(graph: SceneGraph, parent: SceneNode, copyIds: readonly string[]): void {
  const order = new Map(copyIds.map((id, index) => [id, index]))
  const sorted = parent.childIds.toSorted(
    (left, right) =>
      (order.get(left) ?? copyIds.length + parent.childIds.indexOf(left)) -
      (order.get(right) ?? copyIds.length + parent.childIds.indexOf(right))
  )
  // Move through the graph so the reorder is reported, as collaboration syncs it.
  sorted.forEach((childId, index) => {
    if (parent.childIds[index] !== childId) graph.insertChildAt(childId, parent.id, index)
  })
}

function syncCopies(
  graph: SceneGraph,
  context: CopyContext,
  sourceParent: SceneNode,
  targetParent: SceneNode
): void {
  // Syncing a component into its own subtree would clone it into itself without end.
  if (sourceParent.id === targetParent.id || graph.isDescendant(targetParent.id, sourceParent.id))
    return
  const copyIds: string[] = []
  for (const sourceId of sourceParent.childIds) {
    const source = graph.getNode(sourceId)
    if (!source) continue
    const id = copyLayerId(context.scope, source)
    copyIds.push(id)
    const existing = graph.getNode(id)
    if (!existing) {
      const copy = cloneCopy(graph, context, source, sourceParent, targetParent, 'deep')
      const contents = contentsSource(graph, context, copy, source)
      if (contents && contents.source.childIds.length > 0)
        cloneCopies(graph, contents.context, contents.source, copy, 'deep')
      applyEnclosingAssignments(graph, copy)
      continue
    }
    if (existing.parentId !== targetParent.id)
      graph.insertChildAt(id, targetParent.id, targetParent.childIds.length)
    // A swapped instance syncs as an instance of the component swapped in, not from this layer.
    if (!isSwapped(context, existing))
      syncCopy(graph, context, source, existing, sourceParent, targetParent)
    // The component's frame is the authority on which slot this is; instance copies of its
    // bindings are not synced.
    if (ownsSlotContent(graph, existing, slotPropertyId(source))) continue
    const contents = contentsSource(graph, context, existing, source)
    // A swapped instance follows its own component, which syncs it as one of its instances.
    if (contents && contents.source === source && source.childIds.length > 0)
      syncCopies(graph, context, source, existing)
  }
  // Copies of layers the component no longer has go away; the instance's own layers stay.
  const expected = new Set(copyIds)
  for (const childId of targetParent.childIds)
    if (isInstanceLayerId(childId) && !expected.has(childId)) graph.deleteNode(childId)
  orderChildren(graph, targetParent, copyIds)
}

/**
 * Brings one copy inside an instance, and the copies below it, up to date with the layer it
 * copies, as syncing its whole outermost instance would. The layer it copies has a shorter path
 * or sits in a component, so syncing shorter paths first brings sources up to date first.
 */
export function syncInstanceLayer(graph: SceneGraph, copy: SceneNode): void {
  const address = parseInstanceLayerId(copy.id)
  const owner = address && graph.getNode(address.owner)
  const source = instanceLayerSource(graph, copy)
  const parent = copy.parentId ? graph.getNode(copy.parentId) : undefined
  const sourceParent = source?.parentId ? graph.getNode(source.parentId) : undefined
  if (!address || !owner || !source || !parent || !sourceParent) return
  // Below a swapped nested instance, copies are named from that instance, as building them did.
  let scope: InstanceScope = { owner: owner.id, prefix: [] }
  for (let length = address.path.length - 1; length >= 1; length--) {
    const prefix = address.path.slice(0, length)
    if (isSwappedAt(owner, prefix)) {
      scope = { owner: owner.id, prefix }
      break
    }
  }
  const context = { scope, owner }
  if (!isSwapped(context, copy)) syncCopy(graph, context, source, copy, sourceParent, parent)
  if (ownsSlotContent(graph, copy, slotPropertyId(source))) return
  const contents = contentsSource(graph, context, copy, source)
  if (contents && contents.source === source && source.childIds.length > 0)
    syncCopies(graph, context, source, copy)
}

/** Brings the copies an instance shows up to date with `component`. */
export function syncInstanceChildren(
  graph: SceneGraph,
  instance: SceneNode,
  component: SceneNode
): void {
  const scope = instanceScope(instance)
  const owner = graph.getNode(scope.owner)
  if (!owner) throw new Error(`Missing instance ${scope.owner}`)
  syncCopies(graph, { scope, owner }, component, instance)
}
