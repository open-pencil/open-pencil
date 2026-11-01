// Child cloning and property synchronization shared by instance creation, swap, and sync.
import { isEqual } from 'es-toolkit/predicate'

import { cloneNodeProps, copyEffects, copyFills, copyStrokes, copyStyleRuns } from '../copy'
import type { NodeCloneMode } from '../copy'
import type { SceneGraph } from '../graph'
import { scaleNodeChanges } from '../scaling/node'
import { ownsSlotContent, slotPropertyId } from '../slots/frames'
import type { SceneNode } from '../types'
import { scaleVariableBindingUnits } from '../variables/units'
import { applyEnclosingAssignments, assignedFieldValues, propertyDrivenFields } from './assignments'
import { keepOwnContentSize, remeasureChangedText, type SyncedPlacement } from './content-size'
import {
  createInstanceSyncContext,
  hasUnplacedCopiesBelow,
  restoreRemovedCopy,
  unplacedCopy,
  type InstanceSyncContext
} from './copies'
import { INSTANCE_SYNC_FIELD_OWNERS, INSTANCE_SYNC_FIELDS } from './fields'
import { ownsSelfFillField, sourceWithEffectiveFill } from './main-component'
import {
  bindingOverrideField,
  copiedComponentLayerId,
  hasInstanceOverride as hasNodeInstanceOverride,
  overriddenBindingField,
  setInstanceOverride,
  type InstanceOverrideState
} from './overrides'
import { PLACEMENT_FIELDS, placedByConstraints } from './placement'
import { followVectorGeometry } from './vector-geometry'

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
  } else if (key === 'targetAspectRatio') {
    setSceneProp(target, key, source.targetAspectRatio ? { ...source.targetAspectRatio } : null)
  } else {
    const value = source[key]
    setSceneProp(target, key, Array.isArray(value) ? structuredClone(value) : value)
  }
}

export function bindingProtection(scopes: ReadonlySet<string>[]): (field: string) => boolean {
  const fields = new Set<string>()
  for (const scope of scopes) {
    const perField = [...scope].some((field) => overriddenBindingField(field) !== null)
    for (const field of scope) {
      if (field !== 'boundVariables' || !perField) fields.add(field)
    }
  }
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
    if (!protectedField(bindingOverrideField(field))) continue
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
      (protectedField('boundVariables') || protectedField(bindingOverrideField(key))))
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

interface SyncedFieldsInput {
  compParent: SceneNode
  instParent: SceneNode
  /** The component's coordinates in the copy's. */
  factor: number
  /** Fields the copy keeps: overridden, bound, or driven by a property. */
  skip: (key: string) => boolean
}

/** The fields a copy takes from its component's layer, placed in the copy's parent. */
function copySyncedFields(
  updates: Partial<SceneNode>,
  copy: SceneNode,
  source: SceneNode,
  { compParent, instParent, factor, skip }: SyncedFieldsInput
): SyncedPlacement {
  // In an auto layout flow the layout places the copy, as it placed the component's layer.
  const placedByLayout = instParent.layoutMode !== 'NONE' && source.layoutPositioning !== 'ABSOLUTE'
  const placed = placedByLayout
    ? source
    : placedByConstraints(source, compParent, instParent, factor)
  for (const key of INSTANCE_SYNC_FIELDS) {
    if (key === 'boundVariables') continue
    if (placedByLayout && (key === 'x' || key === 'y')) continue
    if (skip(key)) continue
    const owner = INSTANCE_SYNC_FIELD_OWNERS[key]
    if (owner && skip(owner)) continue
    const from = PLACEMENT_FIELDS.has(key) ? placed : source
    // Most fields already match: comparing first spares cloning them for nothing.
    if (isEqual(copy[key], from[key])) continue
    copyProp(updates, from, key)
  }
  // New paints bring their style link, unless the copy keeps a style of its own.
  if (updates.fills)
    updates.fillStyleId = skip('fillStyleId') ? copy.fillStyleId : source.fillStyleId
  followVectorGeometry(updates, copy, source)
  remeasureChangedText(updates, copy)
  return { placed, x: !placedByLayout && !skip('x'), y: !placedByLayout && !skip('y') }
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
  if (changed.fills && updates.fillStyleId !== undefined) changed.fillStyleId = updates.fillStyleId
  if (Object.keys(changed).length) graph.updateNode(target.id, changed)
}

function cloneChildInCoordinates(
  graph: SceneGraph,
  src: SceneNode,
  sourceParent: SceneNode,
  targetParent: SceneNode,
  mode: NodeCloneMode = 'deep'
): SceneNode {
  const componentScale =
    (src.componentScale * targetParent.componentScale) / sourceParent.componentScale
  return graph.createNode(src.type, targetParent.id, {
    ...cloneNodeProps(sourceInTargetCoordinates(src, componentScale), src.id, mode),
    componentScale
  })
}

export function cloneChildrenWithMapping(
  graph: SceneGraph,
  sourceParentId: string,
  destParentId: string,
  mode: NodeCloneMode = 'deep'
): void {
  // A cyclic component, such as an instance of an ancestor, would clone itself without end.
  if (sourceParentId === destParentId || graph.isDescendant(destParentId, sourceParentId)) return

  const sourceParent = graph.nodes.get(sourceParentId)
  const targetParent = graph.nodes.get(destParentId)
  if (!sourceParent || !targetParent) return

  for (const childId of sourceParent.childIds) {
    const src = graph.nodes.get(childId)
    if (!src) continue

    const clone = cloneChildInCoordinates(graph, src, sourceParent, targetParent, mode)

    if (src.childIds.length > 0) {
      cloneChildrenWithMapping(graph, childId, clone.id, mode)
    }
  }
}

export function enclosingInstanceOverrideFields(graph: SceneGraph, node: SceneNode): Set<string>[] {
  const fields: Set<string>[] = []
  let parent = node.parentId ? graph.nodes.get(node.parentId) : undefined
  while (parent) {
    if (parent.type === 'INSTANCE') {
      fields.push(new Set(parent.instanceOverrides.descendants.get(node.id)?.keys()))
    }
    parent = parent.parentId ? graph.nodes.get(parent.parentId) : undefined
  }
  return fields
}

function childBindingProtection(
  graph: SceneGraph,
  child: SceneNode,
  overrides: InstanceOverrideState
) {
  const fields = enclosingInstanceOverrideFields(graph, child)
  fields.push(new Set(overrides.descendants.get(child.id)?.keys()))
  const protectedField = bindingProtection(fields)
  return (field: string) => protectedField(field) || ownsSelfFillField(child, field)
}

function linkMatchedChild(
  overrides: InstanceOverrideState,
  instParentId: string,
  instChild: SceneNode,
  compChildId: string
): void {
  if (instChild.type === 'INSTANCE') {
    setInstanceOverride(overrides, instParentId, instChild.id, 'sourceComponentId', compChildId)
  } else {
    instChild.componentId = compChildId
  }
}

function matchFallbackChildren(
  graph: SceneGraph,
  compParent: SceneNode,
  instParent: SceneNode,
  instParentId: string,
  overrides: InstanceOverrideState,
  instChildMap: Map<string, SceneNode>,
  usedInstChildIds: Set<string>
): void {
  const fallbackByType = new Map<SceneNode['type'], Map<string, SceneNode[]>>()
  const remainingCandidateCount = new Map<SceneNode['type'], number>()
  const unmatchedComponentCount = new Map<SceneNode['type'], number>()
  for (const compChildId of compParent.childIds) {
    if (instChildMap.has(compChildId)) continue
    const child = graph.nodes.get(compChildId)
    if (child) {
      unmatchedComponentCount.set(child.type, (unmatchedComponentCount.get(child.type) ?? 0) + 1)
    }
  }
  for (const childId of instParent.childIds) {
    const child = graph.nodes.get(childId)
    if (!child || usedInstChildIds.has(child.id)) continue
    remainingCandidateCount.set(child.type, (remainingCandidateCount.get(child.type) ?? 0) + 1)
    let byName = fallbackByType.get(child.type)
    if (!byName) {
      byName = new Map()
      fallbackByType.set(child.type, byName)
    }
    const queue = byName.get(child.name)
    if (queue) queue.push(child)
    else byName.set(child.name, [child])
  }

  // Match by name and type with FIFO queues to preserve sibling order in linear time.
  for (const compChildId of compParent.childIds) {
    if (instChildMap.has(compChildId)) continue
    const compChild = graph.nodes.get(compChildId)
    if (!compChild) continue
    const candidatesByName = fallbackByType.get(compChild.type)
    const candidateCount = remainingCandidateCount.get(compChild.type) ?? 0
    if (candidateCount > (unmatchedComponentCount.get(compChild.type) ?? 0)) continue
    const match = candidatesByName?.get(compChild.name)?.shift()
    if (!match) continue
    remainingCandidateCount.set(compChild.type, candidateCount - 1)
    instChildMap.set(compChildId, match)
    usedInstChildIds.add(match.id)
    linkMatchedChild(overrides, instParentId, match, compChildId)
  }
}

function sortInstanceChildren(
  graph: SceneGraph,
  instParent: SceneNode,
  instParentId: string,
  compChildOrder: string[],
  overrides: InstanceOverrideState
): void {
  const orderMap = new Map<string, number>()
  for (let i = 0; i < compChildOrder.length; i++) orderMap.set(compChildOrder[i], i)

  const ranks = new Map<string, number>()
  for (let index = 0; index < instParent.childIds.length; index++) {
    const childId = instParent.childIds[index]
    const node = graph.nodes.get(childId)
    const mapped = node && copiedComponentLayerId(overrides, instParentId, node)
    const componentIndex = mapped ? orderMap.get(mapped) : undefined
    ranks.set(childId, componentIndex ?? compChildOrder.length + index)
  }
  const sorted = instParent.childIds.toSorted(
    (left, right) => (ranks.get(left) ?? 0) - (ranks.get(right) ?? 0)
  )
  // Move through the graph so the reorder is reported, as collaboration syncs it.
  sorted.forEach((childId, index) => {
    if (instParent.childIds[index] !== childId) graph.insertChildAt(childId, instParentId, index)
  })
}

/** True when syncing `compParentId` into `instParentId` would form a cycle. */
function isCyclicSync(graph: SceneGraph, compParentId: string, instParentId: string): boolean {
  return compParentId === instParentId || graph.isDescendant(instParentId, compParentId)
}

/** Children already linked to a component child by sourceComponentId or componentId. */
function matchLinkedChildren(
  graph: SceneGraph,
  instParent: SceneNode,
  instParentId: string,
  overrides: InstanceOverrideState,
  compChildIdSet: ReadonlySet<string>,
  instChildMap: Map<string, SceneNode>,
  usedInstChildIds: Set<string>
): void {
  for (const childId of instParent.childIds) {
    const child = graph.nodes.get(childId)
    if (!child) continue
    const mappedComponentId = copiedComponentLayerId(overrides, instParentId, child)
    if (mappedComponentId && compChildIdSet.has(mappedComponentId)) {
      instChildMap.set(mappedComponentId, child)
      usedInstChildIds.add(child.id)
    }
  }
}

/**
 * Pass 3 of a sync: bring along the copy of a layer moved here inside the component, bring back
 * one the sync removed when its layer returns, or clone a layer the instance has no copy of. A
 * clone takes its own subtree unless copies the instance has belong in it, which the recursion
 * moves in instead. Children left unmatched are the sync's to remove once it finishes.
 */
function placeMissingChildren(
  graph: SceneGraph,
  compParent: SceneNode,
  instParent: SceneNode,
  instChildMap: Map<string, SceneNode>,
  usedInstChildIds: Set<string>,
  context: InstanceSyncContext
): void {
  for (const child of instChildMap.values()) context.matched.add(child.id)

  for (const compChildId of compParent.childIds) {
    if (instChildMap.has(compChildId)) continue
    const moved =
      unplacedCopy(graph, context, compChildId, instParent.id) ??
      restoreRemovedCopy(graph, context, compChildId, instParent.id)
    if (moved) {
      graph.insertChildAt(moved.id, instParent.id, instParent.childIds.length)
      instChildMap.set(compChildId, moved)
      usedInstChildIds.add(moved.id)
      context.matched.add(moved.id)
      continue
    }
    const src = graph.nodes.get(compChildId)
    if (!src) continue
    const clone = cloneChildInCoordinates(graph, src, compParent, instParent)
    if (src.childIds.length > 0 && !hasUnplacedCopiesBelow(graph, context, compChildId)) {
      cloneChildrenWithMapping(graph, compChildId, clone.id)
    }
    applyEnclosingAssignments(graph, clone)
    instChildMap.set(compChildId, clone)
    usedInstChildIds.add(clone.id)
    context.matched.add(clone.id)
  }
  for (const childId of instParent.childIds) {
    if (!usedInstChildIds.has(childId)) context.leftovers.add(childId)
  }
}

export function syncChildren(
  graph: SceneGraph,
  compParentId: string,
  instParentId: string,
  overrides: InstanceOverrideState,
  context: InstanceSyncContext = createInstanceSyncContext(instParentId, overrides)
): void {
  // An instance inside its own component would clone the component into itself without end.
  if (isCyclicSync(graph, compParentId, instParentId)) return

  const compParent = graph.nodes.get(compParentId)
  const instParent = graph.nodes.get(instParentId)
  if (!compParent || !instParent) return

  const instChildMap = new Map<string, SceneNode>()
  const usedInstChildIds = new Set<string>()
  const compChildIdSet = new Set(compParent.childIds)

  // Pass 1: Direct matching via sourceComponentId or componentId
  matchLinkedChildren(
    graph,
    instParent,
    instParentId,
    overrides,
    compChildIdSet,
    instChildMap,
    usedInstChildIds
  )

  // Pass 2: Fallback matching for unmatched children (e.g. from Figma imports)
  matchFallbackChildren(
    graph,
    compParent,
    instParent,
    instParentId,
    overrides,
    instChildMap,
    usedInstChildIds
  )

  placeMissingChildren(graph, compParent, instParent, instChildMap, usedInstChildIds, context)

  // Pass 4: Synchronize properties and recurse
  for (const compChildId of compParent.childIds) {
    const compChild = graph.nodes.get(compChildId)
    const instChild = instChildMap.get(compChildId)
    if (!compChild || !instChild) continue

    const protectedField = childBindingProtection(graph, instChild, overrides)
    const driven = propertyDrivenFields(graph, instChild, compChild)
    const componentScale =
      (compChild.componentScale * instParent.componentScale) / compParent.componentScale
    const effectiveSource = sourceWithEffectiveFill(graph, compChild, instChild)
    const source = sourceInTargetCoordinates(effectiveSource, componentScale)
    // Which properties a layer serves is the component's to say; a slot or exposed layer
    // created on the component becomes one in every instance.
    const updates: Partial<SceneNode> = {
      componentScale,
      componentPropertyReferences: structuredClone(compChild.componentPropertyReferences)
    }
    syncBindingFields(instChild, source, updates, protectedField)
    const placement = copySyncedFields(updates, instChild, source, {
      compParent,
      instParent,
      factor: componentScale / compChild.componentScale,
      skip: (key) => driven.has(key) || isProtectedSyncField(instChild, key, protectedField)
    })
    const assigned = assignedFieldValues(graph, instChild, compChild)
    // A direct label override is more specific than the enclosing text property assignment.
    // Visibility assignments still drive their descendants independently of ancestor visibility.
    if (isProtectedSyncField(instChild, 'text', protectedField)) delete assigned.text
    Object.assign(updates, assigned)
    keepOwnContentSize(graph, updates, instChild, source, placement)
    updateSyncedProps(graph, instChild, updates)

    if (
      compChild.childIds.length > 0 &&
      !hasNodeInstanceOverride(overrides, instParentId, instChild.id, 'componentId') &&
      // The component's frame is the authority on which slot this is; instance copies of
      // its bindings are not synced.
      !ownsSlotContent(graph, instChild, slotPropertyId(compChild))
    ) {
      syncChildren(graph, compChildId, instChild.id, overrides, context)
    }
  }

  // Pass 5: Sort instance children to match component child order
  sortInstanceChildren(graph, instParent, instParentId, compParent.childIds, overrides)
}
