import type { SceneGraph } from '../index'
import type { ComponentPropertyDefinition, SceneNode, SlotSettings } from '../types'
import { slotPropertyId } from './frames'

/** The settings a new slot starts with: no limits, any layer allowed. */
export const DEFAULT_SLOT_SETTINGS: SlotSettings = {
  allowPreferredValuesOnly: false,
  displayEmptyByDefault: false,
  stretchChildOnInsert: false
}

/**
 * The main component a layer belongs to, which defines the slots inside it. Layers of an
 * instance are not authored there, so a layer under an instance has none.
 */
export function slotOwner(graph: SceneGraph, node: SceneNode): SceneNode | undefined {
  let current = node.parentId ? graph.getNode(node.parentId) : undefined
  while (current && current.type !== 'CANVAS') {
    if (current.type === 'COMPONENT') return current
    if (current.type === 'INSTANCE') return undefined
    current = current.parentId ? graph.getNode(current.parentId) : undefined
  }
  return undefined
}

/** Whether a frame inside a main component can become a slot. */
export function canCreateSlot(graph: SceneGraph, node: SceneNode): boolean {
  return node.type === 'FRAME' && !slotPropertyId(node) && !!slotOwner(graph, node)
}

function uniqueSlotName(owner: SceneNode, base: string): string {
  const taken = new Set(owner.componentPropertyDefinitions.map((definition) => definition.name))
  if (!taken.has(base)) return base
  let index = 2
  while (taken.has(`${base} ${index}`)) index++
  return `${base} ${index}`
}

/**
 * Make a frame of a main component a slot: define a SLOT property, named after the frame, on
 * the component and bind the frame's children to it. Instances pick up the slot on their next
 * sync.
 */
export function createSlotProperty(
  graph: SceneGraph,
  frameId: string,
  id: string
): ComponentPropertyDefinition | null {
  const frame = graph.getNode(frameId)
  const owner = frame && canCreateSlot(graph, frame) ? slotOwner(graph, frame) : undefined
  if (!frame || !owner) return null
  const definition: ComponentPropertyDefinition = {
    id,
    name: uniqueSlotName(owner, frame.name.trim() || 'Slot'),
    type: 'SLOT',
    defaultValue: '',
    preferredValues: [],
    slotSettings: { ...DEFAULT_SLOT_SETTINGS }
  }
  graph.updateNode(owner.id, {
    componentPropertyDefinitions: [...owner.componentPropertyDefinitions, definition]
  })
  graph.updateNode(frame.id, {
    componentPropertyReferences: [
      ...frame.componentPropertyReferences,
      { propertyId: id, field: 'SLOT_CONTENT' }
    ]
  })
  return definition
}

/** What a slot's settings panel can change. */
export type SlotPropertyPatch = Partial<
  Pick<ComponentPropertyDefinition, 'name' | 'description' | 'preferredValues'>
> & { slotSettings?: Partial<SlotSettings> }

/** Change a slot property's name, description, preferred components, or limits. */
export function updateSlotProperty(
  graph: SceneGraph,
  ownerId: string,
  propertyId: string,
  patch: SlotPropertyPatch
): boolean {
  const owner = graph.getNode(ownerId)
  const current = owner?.componentPropertyDefinitions.find(
    (definition) => definition.id === propertyId && definition.type === 'SLOT'
  )
  if (!owner || !current) return false
  const { slotSettings, ...fields } = patch
  const next: ComponentPropertyDefinition = {
    ...current,
    ...fields,
    slotSettings: { ...DEFAULT_SLOT_SETTINGS, ...current.slotSettings, ...slotSettings }
  }
  graph.updateNode(owner.id, {
    componentPropertyDefinitions: owner.componentPropertyDefinitions.map((definition) =>
      definition.id === propertyId ? next : definition
    )
  })
  return true
}
