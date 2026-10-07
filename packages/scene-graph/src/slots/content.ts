import type { SceneGraph } from '../index'
import { getInstanceOverride, setInstanceOverride } from '../instance-overrides'
import { cloneChildrenWithMapping } from '../instances/sync'
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

/** Every layer below `node`; `enterInstances` also walks the layers of nested instances. */
function descendants(graph: SceneGraph, node: SceneNode, enterInstances: boolean): SceneNode[] {
  const result: SceneNode[] = []
  const visit = (parent: SceneNode): void => {
    for (const childId of parent.childIds) {
      const child = graph.nodes.get(childId)
      if (!child) continue
      result.push(child)
      if (enterInstances || child.type !== 'INSTANCE') visit(child)
    }
  }
  visit(node)
  return result
}

/**
 * Make the instance own its slot's content, as Figma does on the first edit: the layers
 * stay where they are, but stop following the component. Overrides the instance held for
 * them become their own values, or move to the nested instance they belong to.
 */
export function claimSlotContent(
  graph: SceneGraph,
  scope: Extract<SlotScope, { kind: 'slot' }>
): void {
  const { frame, instance, propertyId } = scope
  if (ownsSlotContent(graph, frame, propertyId)) return
  const overrides = instance.instanceOverrides
  for (const node of descendants(graph, frame, false)) {
    overrides.descendants.delete(node.id)
    if (node.type !== 'INSTANCE') {
      graph.updateNode(node.id, { componentId: null })
      continue
    }
    // A nested instance keeps the overrides its former owner applied inside it.
    for (const inner of descendants(graph, node, true)) {
      const fields = overrides.descendants.get(inner.id)
      if (!fields) continue
      for (const [field, value] of fields)
        if (field !== 'sourceComponentId')
          setInstanceOverride(node.instanceOverrides, node.id, inner.id, field, value)
      overrides.descendants.delete(inner.id)
    }
    graph.updateNode(node.id, { instanceOverrides: node.instanceOverrides })
  }
  graph.updateNode(instance.id, {
    instanceOverrides: overrides,
    componentPropertyAssignments: { ...instance.componentPropertyAssignments, [propertyId]: '' }
  })
}

/** The component layer an instance layer was cloned from. */
function componentSource(instance: SceneNode, node: SceneNode): string | null {
  const mapped = getInstanceOverride(
    instance.instanceOverrides,
    instance.id,
    node.id,
    'sourceComponentId'
  )
  return typeof mapped === 'string' ? mapped : node.componentId
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
  const source = componentSource(instance, frame)
  if (source && graph.nodes.has(source)) cloneChildrenWithMapping(graph, source, frame.id)
}

/** Remove everything from the slot; the instance keeps owning it, now empty. */
export function clearSlotContent(
  graph: SceneGraph,
  scope: Extract<SlotScope, { kind: 'slot' }>
): void {
  claimSlotContent(graph, scope)
  for (const childId of Array.from(scope.frame.childIds)) graph.deleteNode(childId)
}
