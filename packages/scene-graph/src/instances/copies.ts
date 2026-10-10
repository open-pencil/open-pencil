// How an instance's copies follow the component's layers when its structure changes.
import type { SceneGraph, SceneNode } from '../'
import {
  getInstanceOverride,
  hasInstanceOverride as hasNodeInstanceOverride,
  type InstanceOverrideState
} from '../instance-overrides'
import { ownsSlotContent, slotPropertyId } from '../slots/frames'

/**
 * One instance's sync: the copies it has matched to the component's layers, the parents it
 * synced, and, built on first need, the copies the instance had before, by the layer they copy.
 * Copies follow their layers when the component's structure changes, as Figma moves them: a
 * layer moved inside the component keeps its copy and the copy's overrides, and a copy whose
 * layer left or was deleted goes.
 */
export interface InstanceSyncContext {
  instanceId: string
  overrides: InstanceOverrideState
  matched: Set<string>
  leftovers: Set<string>
  copies?: Map<string, SceneNode[]>
}

export function createInstanceSyncContext(
  instanceId: string,
  overrides: InstanceOverrideState
): InstanceSyncContext {
  return { instanceId, overrides, matched: new Set(), leftovers: new Set() }
}

/** The component layer a copy in the instance stands for. */
function copiedLayerId(node: SceneNode, context: InstanceSyncContext): string | undefined {
  const source =
    node.type === 'INSTANCE'
      ? getInstanceOverride(context.overrides, context.instanceId, node.id, 'sourceComponentId')
      : undefined
  return typeof source === 'string' ? source : (node.componentId ?? undefined)
}

/** Whether sync goes inside a copy: not into slot content, a swapped instance, or an instance. */
function syncsInside(graph: SceneGraph, node: SceneNode, context: InstanceSyncContext): boolean {
  if (node.type === 'INSTANCE') return false
  if (hasNodeInstanceOverride(context.overrides, context.instanceId, node.id, 'componentId')) {
    return false
  }
  const layer = node.componentId ? graph.nodes.get(node.componentId) : undefined
  return !layer || !ownsSlotContent(graph, node, slotPropertyId(layer))
}

function copiesOf(graph: SceneGraph, context: InstanceSyncContext): Map<string, SceneNode[]> {
  if (context.copies) return context.copies
  const copies = new Map<string, SceneNode[]>()
  const visit = (parent: SceneNode) => {
    for (const id of parent.childIds) {
      const child = graph.nodes.get(id)
      if (!child) continue
      const layerId = copiedLayerId(child, context)
      if (layerId) copies.set(layerId, [...(copies.get(layerId) ?? []), child])
      if (syncsInside(graph, child, context)) visit(child)
    }
  }
  const instance = graph.nodes.get(context.instanceId)
  if (instance) visit(instance)
  context.copies = copies
  return copies
}

/** A copy of `layerId` the sync has not placed yet, which a moved layer takes along. */
export function unplacedCopy(
  graph: SceneGraph,
  context: InstanceSyncContext,
  layerId: string,
  instParentId: string
): SceneNode | undefined {
  return copiesOf(graph, context)
    .get(layerId)
    ?.find(
      (copy) =>
        !context.matched.has(copy.id) &&
        graph.nodes.has(copy.id) &&
        copy.id !== instParentId &&
        !graph.isDescendant(instParentId, copy.id)
    )
}

/** Whether any layer in the component subtree at `layerId` already has a copy to move. */
export function hasUnplacedCopiesBelow(
  graph: SceneGraph,
  context: InstanceSyncContext,
  layerId: string
): boolean {
  const copies = copiesOf(graph, context)
  if (copies.size === 0) return false
  const layer = graph.nodes.get(layerId)
  return (layer?.childIds ?? []).some(
    (id) =>
      copies.get(id)?.some((copy) => !context.matched.has(copy.id)) ||
      hasUnplacedCopiesBelow(graph, context, id)
  )
}

/** A copy the sync removed, kept so the layer coming back, as on undo, brings it back as it was. */
interface RemovedCopy {
  /** The copy and everything in it, parents first. */
  nodes: SceneNode[]
  overrides: Map<string, Map<string, unknown>>
}

/** Removed copies by instance, then by the layer they copied. */
const removedCopies = new WeakMap<SceneGraph, Map<string, Map<string, RemovedCopy>>>()

function removedCopiesOf(graph: SceneGraph, instanceId: string): Map<string, RemovedCopy> {
  let byInstance = removedCopies.get(graph)
  if (!byInstance) {
    byInstance = new Map()
    removedCopies.set(graph, byInstance)
  }
  let copies = byInstance.get(instanceId)
  if (!copies) {
    copies = new Map()
    byInstance.set(instanceId, copies)
  }
  return copies
}

/**
 * Brings back the copy of `layerId` the sync removed from this instance, with the same layers
 * and overrides, as Figma restores an instance's override when the layer's deletion is undone.
 */
export function restoreRemovedCopy(
  graph: SceneGraph,
  context: InstanceSyncContext,
  layerId: string,
  instParentId: string
): SceneNode | undefined {
  const removed = removedCopiesOf(graph, context.instanceId)
  const entry = removed.get(layerId)
  if (!entry) return undefined
  removed.delete(layerId)
  const root = entry.nodes.at(0)
  if (!root || entry.nodes.some((node) => graph.nodes.has(node.id))) return undefined
  for (const node of entry.nodes) {
    const { id, type, parentId, childIds: _childIds, ...props } = structuredClone(node)
    graph.createNodeWithId(id, type, id === root.id ? instParentId : parentId, props)
  }
  for (const [id, fields] of entry.overrides) context.overrides.descendants.set(id, new Map(fields))
  return graph.nodes.get(root.id)
}

/**
 * Deletes the copies the sync left over: ones whose layer left the component, was deleted, or
 * now has another copy. Copies the instance owns, such as slot content, are never reached.
 */
export function removeLeftoverCopies(graph: SceneGraph, context: InstanceSyncContext): void {
  for (const id of context.leftovers) {
    const node = graph.nodes.get(id)
    const layerId = node ? copiedLayerId(node, context) : undefined
    if (!node || !layerId || context.matched.has(id)) continue
    const nodes: SceneNode[] = []
    const collect = (current: SceneNode) => {
      nodes.push(structuredClone(current))
      for (const childId of current.childIds) {
        const child = graph.nodes.get(childId)
        if (child) collect(child)
      }
    }
    collect(node)
    const overrides = new Map<string, Map<string, unknown>>()
    for (const removed of nodes) {
      const fields = context.overrides.descendants.get(removed.id)
      if (fields) overrides.set(removed.id, new Map(fields))
      context.overrides.descendants.delete(removed.id)
    }
    removedCopiesOf(graph, context.instanceId).set(layerId, { nodes, overrides })
    graph.deleteNode(id)
  }
  context.leftovers.clear()
}
