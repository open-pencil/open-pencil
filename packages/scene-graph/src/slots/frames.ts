import type { SceneGraph } from '../index'
import { instanceMainComponent } from '../instances/main-component'
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

/** The name of a slot property as the instance's component (or the component's set) defines it. */
function slotName(graph: SceneGraph, instance: SceneNode, propertyId: string) {
  const component = instanceMainComponent(graph, instance)
  const set = component?.parentId ? graph.nodes.get(component.parentId) : undefined
  return [component, set]
    .flatMap((node) => node?.componentPropertyDefinitions ?? [])
    .find((definition) => definition.id === propertyId && definition.type === 'SLOT')?.name
}

/** An instance's slot frames, without entering nested instances, whose slots are their own. */
export function instanceSlotFrames(graph: SceneGraph, instance: SceneNode): SceneNode[] {
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

/** One slot's owned content, parked while the instance it belongs to is rebuilt. */
interface ParkedSlot {
  /** Names of the nested instances leading to the slot's owner; empty for the instance itself. */
  path: string[]
  /** The slot property's name, which the replacement must share. */
  name: string
  /** Content layer ids, in layer order. */
  content: string[]
}

/** Owned slot content parked under an instance while its component changes. */
export interface ParkedSlotContent {
  slots: ParkedSlot[]
  /** The instance's own slot assignments the content was parked from. */
  propertyIds: string[]
}

/** Instances directly inside this one: not inside another nested instance or a slot. */
function nestedInstances(graph: SceneGraph, owner: SceneNode): SceneNode[] {
  const found: SceneNode[] = []
  const visit = (node: SceneNode): void => {
    for (const childId of node.childIds) {
      const child = graph.nodes.get(childId)
      if (!child || slotPropertyId(child)) continue
      if (child.type === 'INSTANCE') found.push(child)
      else visit(child)
    }
  }
  visit(owner)
  return found
}

/** The nested instance a name path leads to from `root`, matched by layer name as Figma does. */
function instanceAtPath(
  graph: SceneGraph,
  root: SceneNode,
  path: readonly string[]
): SceneNode | undefined {
  let current: SceneNode | undefined = root
  for (const name of path) {
    current = current && nestedInstances(graph, current).find((node) => node.name === name)
  }
  return current
}

/**
 * Park the slot content an instance and the instances nested in it own, by slot name and the
 * nested instance's name path, directly under the instance, so its component can be replaced.
 * Figma keeps that content when a variant switch or swap leads to slots of the same names.
 */
export function detachOwnedSlotContent(graph: SceneGraph, instance: SceneNode): ParkedSlotContent {
  const parked: ParkedSlotContent = { slots: [], propertyIds: [] }
  const visit = (owner: SceneNode, path: string[]): void => {
    for (const nested of nestedInstances(graph, owner)) visit(nested, [...path, nested.name])
    for (const frame of instanceSlotFrames(graph, owner)) {
      const propertyId = slotPropertyId(frame)
      if (!propertyId || !Object.hasOwn(owner.componentPropertyAssignments, propertyId)) continue
      if (owner.id === instance.id) parked.propertyIds.push(propertyId)
      const name = slotName(graph, owner, propertyId)
      const key = [...path, name].join('\u0000')
      if (!name || parked.slots.some((slot) => [...slot.path, slot.name].join('\u0000') === key))
        continue
      const content = [...frame.childIds]
      for (const id of content) graph.reorderChild(id, instance.id, instance.childIds.length)
      parked.slots.push({ path, name, content })
    }
  }
  visit(instance, [])
  return parked
}

/** Move parked content into the slots of the same names and paths, and reassign them. */
export function restoreOwnedSlotContent(
  graph: SceneGraph,
  instance: SceneNode,
  parked: ParkedSlotContent
): void {
  if (parked.slots.length === 0 && parked.propertyIds.length === 0) return
  graph.updateNode(instance.id, {
    componentPropertyAssignments: Object.fromEntries(
      Object.entries(instance.componentPropertyAssignments).filter(
        ([id]) => !parked.propertyIds.includes(id)
      )
    )
  })
  for (const slot of parked.slots) {
    const owner = instanceAtPath(graph, instance, slot.path)
    const frame =
      owner &&
      instanceSlotFrames(graph, owner).find((candidate) => {
        const propertyId = slotPropertyId(candidate)
        return !!propertyId && slotName(graph, owner, propertyId) === slot.name
      })
    const propertyId = frame && slotPropertyId(frame)
    if (
      !owner ||
      !frame ||
      !propertyId ||
      Object.hasOwn(owner.componentPropertyAssignments, propertyId)
    ) {
      for (const id of slot.content) graph.deleteNode(id)
      continue
    }
    for (const id of Array.from(frame.childIds)) graph.deleteNode(id)
    for (const [index, id] of slot.content.entries()) graph.reorderChild(id, frame.id, index)
    graph.updateNode(owner.id, {
      componentPropertyAssignments: { ...owner.componentPropertyAssignments, [propertyId]: '' }
    })
  }
}
