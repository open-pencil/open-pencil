import type { SceneGraph } from '../index'
import { overrideTarget } from '../instances/addressing'
import { overridePathKey, parseInstanceLayerId } from '../instances/layer-ids'
import type { SceneNode } from '../types'
import { ownsSlotContent, slotPropertyId } from './frames'

/**
 * Where layers may be added, moved, or removed under a parent:
 * - `free`: outside any instance, or inside a component definition;
 * - `slot`: inside a slot of an instance, whose content the instance owns or can claim;
 * - `locked`: anywhere else inside an instance, whose layers come from its component.
 */
export type SlotScope =
  | { kind: 'free' }
  | { kind: 'slot'; frame: SceneNode; instance: SceneNode; propertyId: string }
  | { kind: 'locked'; instance: SceneNode }

function parentOf(graph: SceneGraph, node: SceneNode): SceneNode | undefined {
  return node.parentId ? graph.nodes.get(node.parentId) : undefined
}

function nearestInstance(graph: SceneGraph, node: SceneNode): SceneNode | undefined {
  let current = parentOf(graph, node)
  while (current && current.type !== 'INSTANCE') current = parentOf(graph, current)
  return current
}

export function slotScope(graph: SceneGraph, parentId: string): SlotScope {
  let current = graph.nodes.get(parentId)
  while (current) {
    const propertyId = slotPropertyId(current)
    if (propertyId) {
      const instance = nearestInstance(graph, current)
      return instance ? { kind: 'slot', frame: current, instance, propertyId } : { kind: 'free' }
    }
    if (current.type === 'INSTANCE') return { kind: 'locked', instance: current }
    current = parentOf(graph, current)
  }
  return { kind: 'free' }
}

/**
 * Make the instance own its slot's content, as Figma does on the first edit: the layers stay
 * where they are, under the ids they have, but stop following the component. What the instance
 * overrode on them becomes their own values; overrides inside nested instances still apply.
 */
export function claimSlotContent(
  graph: SceneGraph,
  scope: Extract<SlotScope, { kind: 'slot' }>
): void {
  const { frame, instance, propertyId } = scope
  if (ownsSlotContent(graph, frame, propertyId)) return
  const content: string[] = []
  const visit = (node: SceneNode): void => {
    for (const child of graph.getChildren(node.id)) {
      const address = parseInstanceLayerId(child.id)
      if (address) content.push(overridePathKey(address.path))
      if (child.type !== 'INSTANCE') visit(child)
    }
  }
  visit(frame)
  const target = overrideTarget(graph, frame)
  if (target) {
    for (const key of content) target.owner.instanceOverrides.layers.delete(key)
    graph.updateNode(target.owner.id, { instanceOverrides: target.owner.instanceOverrides })
  }
  graph.updateNode(instance.id, {
    componentPropertyAssignments: { ...instance.componentPropertyAssignments, [propertyId]: '' }
  })
}

/** Return the slot to its component's content: the instance stops owning it. */
export function resetSlotContent(
  graph: SceneGraph,
  scope: Extract<SlotScope, { kind: 'slot' }>
): void {
  const { frame, instance, propertyId } = scope
  for (const childId of Array.from(frame.childIds)) graph.deleteNode(childId)
  const assignments = { ...instance.componentPropertyAssignments }
  Reflect.deleteProperty(assignments, propertyId)
  graph.updateNode(instance.id, { componentPropertyAssignments: assignments })
  // Syncing the outermost instance builds the component's content again.
  const target = overrideTarget(graph, instance)
  if (target) graph.syncInstance(target.owner.id)
}

/** Remove everything from the slot; the instance keeps owning it, now empty. */
export function clearSlotContent(
  graph: SceneGraph,
  scope: Extract<SlotScope, { kind: 'slot' }>
): void {
  claimSlotContent(graph, scope)
  for (const childId of Array.from(scope.frame.childIds)) graph.deleteNode(childId)
}
