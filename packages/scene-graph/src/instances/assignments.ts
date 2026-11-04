// What enclosing instances assign the component properties that drive a copy's layers.
import type { SceneGraph } from '../graph'
import type { ComponentPropertyReferenceField, SceneNode } from '../types'

/** SLOT_CONTENT is absent because it drives children, which `ownsSlotContent` keeps instead. */
const PROPERTY_REFERENCE_FIELDS: Partial<Record<ComponentPropertyReferenceField, string>> = {
  VISIBLE: 'visible',
  TEXT: 'text',
  INSTANCE_SWAP: 'componentId'
}

/** Instance links are expected to be shallow; the cap only stops a cycle from hanging sync. */
const INSTANCE_CHAIN_LIMIT = 16

/**
 * Whether this instance's component, or the set it is a variant of, is where `propertyId` is
 * defined. Only a set counts: a component nested in an ordinary component defines its own
 * properties, not the outer one's.
 */
function definesProperty(graph: SceneGraph, instance: SceneNode, propertyId: string): boolean {
  // An instance of an instance links through to the component, so follow the chain to it.
  let component = instance.componentId ? graph.nodes.get(instance.componentId) : undefined
  for (let hops = 0; component?.type === 'INSTANCE' && hops < INSTANCE_CHAIN_LIMIT; hops++) {
    component = component.componentId ? graph.nodes.get(component.componentId) : undefined
  }
  const parent = component?.parentId ? graph.nodes.get(component.parentId) : undefined
  const set = parent?.type === 'COMPONENT_SET' ? parent : undefined
  return [component, set]
    .flatMap((node) => node?.componentPropertyDefinitions ?? [])
    .some((definition) => definition.id === propertyId)
}

/**
 * What the nearest enclosing instance assigns `propertyId`, if any does. An instance assigns its
 * children, not itself, so the walk starts at the parent. A property id belongs to the component
 * that defines it, so the walk stops at an instance of that component even when it assigns
 * nothing; otherwise an outer instance's unrelated property of the same id wins.
 */
function enclosingAssignment(
  graph: SceneGraph,
  node: SceneNode,
  propertyId: string
): string | undefined {
  let current = node.parentId ? graph.nodes.get(node.parentId) : undefined
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
 * A component can gain a property-driven layer after an instance of it exists. Pass 4 leaves a
 * driven field alone, so the fresh clone has to take the enclosing instance's assignment here or
 * it keeps the component's default while every other instance layer shows the assigned value.
 */
export function applyEnclosingAssignments(graph: SceneGraph, clone: SceneNode): void {
  for (const reference of clone.componentPropertyReferences) {
    const field = PROPERTY_REFERENCE_FIELDS[reference.field]
    if (!field) continue
    const value = enclosingAssignment(graph, clone, reference.propertyId)
    if (value === undefined) continue
    if (field === 'visible') graph.updateNode(clone.id, { visible: value === 'true' })
    else if (field === 'text') graph.updateNode(clone.id, { text: value })
    else if (field === 'componentId' && clone.type === 'INSTANCE' && graph.nodes.has(value)) {
      graph.swapInstanceComponent(clone.id, value)
    }
  }
  for (const child of graph.getChildren(clone.id)) applyEnclosingAssignments(graph, child)
}

/**
 * Fields a component property drives on this child. The component states the default, but
 * an enclosing instance's assignment decides the value, so synchronising must not copy the
 * default over it — a page loaded later would otherwise reset the instance to the default.
 */
export function propertyDrivenFields(
  graph: SceneGraph,
  instChild: SceneNode,
  compChild: SceneNode
): Set<string> {
  const driven = new Set<string>()
  for (const reference of compChild.componentPropertyReferences) {
    const field = PROPERTY_REFERENCE_FIELDS[reference.field]
    if (field && hasEnclosingAssignment(graph, instChild, reference.propertyId)) driven.add(field)
  }
  return driven
}

/**
 * The text and visibility enclosing assignments give an existing child whose layer a property
 * drives. A layer linked to a property after the instance was made would otherwise keep what it
 * showed before, since synchronising leaves driven fields alone.
 */
export function assignedFieldValues(
  graph: SceneGraph,
  instChild: SceneNode,
  compChild: SceneNode
): Partial<SceneNode> {
  const values: Partial<SceneNode> = {}
  for (const reference of compChild.componentPropertyReferences) {
    const value = enclosingAssignment(graph, instChild, reference.propertyId)
    if (value === undefined) continue
    if (reference.field === 'TEXT' && instChild.type === 'TEXT') values.text = value
    else if (reference.field === 'VISIBLE') values.visible = value === 'true'
  }
  return values
}
