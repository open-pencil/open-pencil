import { canCreateSlot, slotOwner, slotPropertyId } from '@open-pencil/scene-graph'
import type {
  ComponentPropertyDefinition,
  SceneNode,
  SlotPropertyPatch
} from '@open-pencil/scene-graph'

import { useEditor } from '#vue/editor/context'
import { useSceneComputed } from '#vue/internal/scene-computed/use'

import { slotInstanceOptions, type SlotInstanceOption } from './instance'

/** A slot property as its main component defines it. */
export interface SlotDefinitionControl {
  id: string
  name: string
  description: string
  minChildren?: number
  maxChildren?: number
  preferredOnly: boolean
  /** Components the slot prefers, resolved from the definition's preferred values. */
  preferred: SlotInstanceOption[]
}

/** The value a preferred-components list stores for a component: its key, else its id. */
function preferredValue(component: SceneNode): string {
  return component.componentKey ?? component.id
}

/**
 * Slot properties of the selected main component or slot frame, with the actions that
 * create, configure, and remove them.
 */
export function useSlotAuthoring() {
  const editor = useEditor()
  const target = useSceneComputed(() => {
    const nodes = editor.getSelectedNodes()
    if (nodes.length !== 1) return undefined
    const [node] = nodes
    if (node.type === 'COMPONENT') return { owner: node, frame: undefined, propertyId: undefined }
    const owner = slotOwner(editor.graph, node)
    if (!owner) return undefined
    const propertyId = slotPropertyId(node)
    if (!propertyId && !canCreateSlot(editor.graph, node)) return undefined
    return { owner, frame: node, propertyId }
  })
  const slots = useSceneComputed<SlotDefinitionControl[]>(() => {
    const current = target.value
    if (!current) return []
    return current.owner.componentPropertyDefinitions
      .filter((definition) => definition.type === 'SLOT')
      .filter((definition) => !current.frame || definition.id === current.propertyId)
      .map((definition) => {
        const values = new Set(definition.preferredValues)
        return {
          id: definition.id,
          name: definition.name,
          description: definition.description ?? '',
          minChildren: definition.slotSettings?.minChildren,
          maxChildren: definition.slotSettings?.maxChildren,
          preferredOnly: definition.slotSettings?.allowPreferredValuesOnly ?? false,
          preferred: slotInstanceOptions(editor.graph, definition).filter(
            (option) => option.preferred && values.size > 0
          )
        }
      })
  })
  /** Whether the selection is a frame that can become a slot. */
  const canCreate = useSceneComputed(() => !!target.value?.frame && !target.value.propertyId)
  const active = useSceneComputed(() => slots.value.length > 0 || canCreate.value)

  function update(propertyId: string, patch: SlotPropertyPatch) {
    const owner = target.value?.owner
    if (owner) editor.updateSlot(owner.id, propertyId, patch)
  }

  function definition(propertyId: string): ComponentPropertyDefinition | undefined {
    return target.value?.owner.componentPropertyDefinitions.find((item) => item.id === propertyId)
  }

  /** Components that can be marked preferred, the slot's current choices first. */
  function options(propertyId: string): SlotInstanceOption[] {
    const found = definition(propertyId)
    return found ? slotInstanceOptions(editor.graph, found) : []
  }

  function setPreferred(propertyId: string, componentId: string, preferred: boolean) {
    const found = definition(propertyId)
    const component = editor.graph.getNode(componentId)
    if (!found || !component) return
    const keys = new Set([component.id, component.componentKey, component.sourceLibraryKey])
    const rest = (found.preferredValues ?? []).filter((value) => !keys.has(value))
    update(propertyId, {
      preferredValues: preferred ? [...rest, preferredValue(component)] : rest
    })
  }

  return {
    active,
    canCreate,
    slots,
    options,
    create: () => editor.createSlot(),
    rename: (propertyId: string, name: string) => update(propertyId, { name }),
    describe: (propertyId: string, description: string) => update(propertyId, { description }),
    setLimits: (propertyId: string, limits: { minChildren?: number; maxChildren?: number }) =>
      update(propertyId, { slotSettings: limits }),
    setPreferredOnly: (propertyId: string, value: boolean) =>
      update(propertyId, { slotSettings: { allowPreferredValuesOnly: value } }),
    setPreferred,
    remove: (propertyId: string) => {
      const owner = target.value?.owner
      if (owner) editor.removeSlot(owner.id, propertyId)
    }
  }
}
