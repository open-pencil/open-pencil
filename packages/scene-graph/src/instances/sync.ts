import { isEqual } from 'es-toolkit/predicate'

import type { SceneGraph, SceneNode } from '../'
import { cloneNodeProps, copyEffects, copyFills, copyStrokes, copyStyleRuns } from '../copy'
import type { NodeCloneMode } from '../copy'
import {
  getInstanceOverride,
  hasInstanceOverride as hasNodeInstanceOverride,
  setInstanceOverride,
  type InstanceOverrideState
} from '../instance-overrides'
import { scaleNodeChanges } from '../scaling/node'
import { scaleVariableBindingUnits } from '../variables/units'
import { INSTANCE_SYNC_FIELDS } from './fields'

/** Child cloning and property synchronization shared by instance creation, swap, and sync. */
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

export function bindingProtection(scopes: ReadonlySet<string>[]): (field: string) => boolean {
  const fields = new Set<string>()
  for (const scope of scopes) {
    const perField = [...scope].some((field) => field.startsWith('boundVariables/'))
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
  // Guard against cloning a subtree into itself or its own descendant. Without this,
  // a self-referential or cyclic component (e.g. an INSTANCE whose componentId points
  // to an ancestor) causes unbounded recursion and eventual stack overflow / OOM.
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
  return bindingProtection(fields)
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
    const source = node
      ? getInstanceOverride(overrides, instParentId, node.id, 'sourceComponentId')
      : undefined
    const mapped = typeof source === 'string' ? source : node?.componentId
    const componentIndex = mapped ? orderMap.get(mapped) : undefined
    ranks.set(childId, componentIndex ?? compChildOrder.length + index)
  }
  instParent.childIds.sort((left, right) => (ranks.get(left) ?? 0) - (ranks.get(right) ?? 0))
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
    const sourceComponentId = getInstanceOverride(
      overrides,
      instParentId,
      child.id,
      'sourceComponentId'
    )
    const mappedComponentId =
      typeof sourceComponentId === 'string' ? sourceComponentId : child.componentId
    if (mappedComponentId && compChildIdSet.has(mappedComponentId)) {
      instChildMap.set(mappedComponentId, child)
      usedInstChildIds.add(child.id)
    }
  }
}

export function syncChildren(
  graph: SceneGraph,
  compParentId: string,
  instParentId: string,
  overrides: InstanceOverrideState
): void {
  // Guard against cyclic sync: if the instance parent is inside the component's own
  // subtree, syncing would clone the component into itself — a self-referential cycle
  // that causes unbounded recursion and OOM.
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

  // Pass 3: Clone only genuinely missing component children
  for (const compChildId of compParent.childIds) {
    if (!instChildMap.has(compChildId)) {
      const src = graph.nodes.get(compChildId)
      if (!src) continue
      const clone = cloneChildInCoordinates(graph, src, compParent, instParent)
      if (src.childIds.length > 0) {
        cloneChildrenWithMapping(graph, compChildId, clone.id)
      }
      instChildMap.set(compChildId, clone)
      usedInstChildIds.add(clone.id)
    }
  }

  // Pass 4: Synchronize properties and recurse
  for (const compChildId of compParent.childIds) {
    const compChild = graph.nodes.get(compChildId)
    const instChild = instChildMap.get(compChildId)
    if (!compChild || !instChild) continue

    const protectedField = childBindingProtection(graph, instChild, overrides)
    const componentScale =
      (compChild.componentScale * instParent.componentScale) / compParent.componentScale
    const source = sourceInTargetCoordinates(compChild, componentScale)
    const updates: Partial<SceneNode> = { componentScale }
    syncBindingFields(instChild, source, updates, protectedField)
    for (const key of INSTANCE_SYNC_FIELDS) {
      if (key === 'boundVariables') continue
      if (isProtectedSyncField(instChild, key, protectedField)) continue

      copyProp(updates, source, key)
    }
    updateSyncedProps(graph, instChild, updates)

    if (
      compChild.childIds.length > 0 &&
      !hasNodeInstanceOverride(overrides, instParentId, instChild.id, 'componentId')
    ) {
      syncChildren(graph, compChildId, instChild.id, overrides)
    }
  }

  // Pass 5: Sort instance children to match component child order
  sortInstanceChildren(graph, instParent, instParentId, compParent.childIds, overrides)
}
