import type { SceneGraph } from '../index'
import type { SceneNode } from '../types'

/** The slot property a frame holds the content of, if it is a slot. */
export function slotPropertyId(node: SceneNode): string | undefined {
  return node.componentPropertyReferences.find((reference) => reference.field === 'SLOT_CONTENT')
    ?.propertyId
}

/**
 * Whether this slot frame's children belong to its instance rather than its component: the
 * nearest enclosing instance assigns the slot. Such content is never synced from the component.
 */
export function ownsSlotContent(
  graph: SceneGraph,
  node: SceneNode,
  propertyId = slotPropertyId(node)
): boolean {
  if (!propertyId) return false
  let owner = node.parentId ? graph.nodes.get(node.parentId) : undefined
  while (owner && owner.type !== 'INSTANCE')
    owner = owner.parentId ? graph.nodes.get(owner.parentId) : undefined
  return !!owner && Object.hasOwn(owner.componentPropertyAssignments, propertyId)
}

/** The name of a slot property as its component (or the component's set) defines it. */
function slotName(graph: SceneGraph, componentId: string | null, propertyId: string) {
  const component = componentId ? graph.nodes.get(componentId) : undefined
  const set = component?.parentId ? graph.nodes.get(component.parentId) : undefined
  return [component, set]
    .flatMap((node) => node?.componentPropertyDefinitions ?? [])
    .find((definition) => definition.id === propertyId && definition.type === 'SLOT')?.name
}

/** An instance's slot frames, without entering nested instances, whose slots are their own. */
function slotFrames(graph: SceneGraph, instance: SceneNode): SceneNode[] {
  const frames: SceneNode[] = []
  const visit = (node: SceneNode): void => {
    for (const childId of node.childIds) {
      const child = graph.nodes.get(childId)
      if (!child) continue
      if (slotPropertyId(child)) frames.push(child)
      else if (child.type !== 'INSTANCE') visit(child)
    }
  }
  visit(instance)
  return frames
}

/** Owned slot content parked under its instance while the instance's component changes. */
export interface ParkedSlotContent {
  /** Content layer ids by slot name, in layer order. */
  content: Map<string, string[]>
  /** The slot assignments the content was parked from. */
  propertyIds: string[]
}

/**
 * Park an instance's own slot content directly under the instance, by slot name, so the
 * instance's component can be replaced. Figma keeps that content when a variant switch or
 * swap lands on a component with a slot of the same name.
 */
export function detachOwnedSlotContent(graph: SceneGraph, instance: SceneNode): ParkedSlotContent {
  const parked: ParkedSlotContent = { content: new Map(), propertyIds: [] }
  for (const frame of slotFrames(graph, instance)) {
    const propertyId = slotPropertyId(frame)
    if (!propertyId || !Object.hasOwn(instance.componentPropertyAssignments, propertyId)) continue
    parked.propertyIds.push(propertyId)
    const name = slotName(graph, instance.componentId, propertyId)
    if (!name || parked.content.has(name)) continue
    const content = [...frame.childIds]
    for (const id of content) graph.reorderChild(id, instance.id, instance.childIds.length)
    parked.content.set(name, content)
  }
  return parked
}

/** Move parked content into the new component's slots of the same name and reassign them. */
export function restoreOwnedSlotContent(
  graph: SceneGraph,
  instance: SceneNode,
  parked: ParkedSlotContent
): void {
  if (!parked.propertyIds.length) return
  const assignments = Object.fromEntries(
    Object.entries(instance.componentPropertyAssignments).filter(
      ([id]) => !parked.propertyIds.includes(id)
    )
  )
  const placed = new Set<string>()
  for (const frame of slotFrames(graph, instance)) {
    const propertyId = slotPropertyId(frame)
    const name = propertyId && slotName(graph, instance.componentId, propertyId)
    const content = name ? parked.content.get(name) : undefined
    if (!propertyId || !name || !content || placed.has(name)) continue
    for (const id of Array.from(frame.childIds)) graph.deleteNode(id)
    for (const [index, id] of content.entries()) graph.reorderChild(id, frame.id, index)
    assignments[propertyId] = ''
    placed.add(name)
  }
  for (const [name, content] of parked.content)
    if (!placed.has(name)) for (const id of content) graph.deleteNode(id)
  graph.updateNode(instance.id, { componentPropertyAssignments: assignments })
}
