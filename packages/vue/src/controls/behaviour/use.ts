import {
  behaviourContract,
  behaviourOwner,
  behaviourProperties,
  booleanBinding,
  DEFAULT_NUMBER_SETTINGS,
  emptyBehaviour,
  guessInteractionStates,
  guessOnOff,
  INTERACTION_STATES,
  isNumberRange,
  missingBindings,
  partBinding,
  readBehaviour,
  textBinding,
  type Behaviour,
  type BehaviourKind,
  type BehaviourNumberSettings,
  type InteractionState
} from '@open-pencil/scene-graph'

import type { VariantDefinitionControl } from '#vue/controls/variants'
import { useEditor } from '#vue/editor/context'
import { useSceneComputed } from '#vue/internal/scene-computed/use'

import type { BehaviourControl, BehaviourValueControl } from './types'

/**
 * The behaviour of the selected main component or component set, as the properties panel
 * shows it, and the edits it makes. Each edit is one undo step.
 */
export function useBehaviour() {
  const editor = useEditor()
  const owner = useSceneComputed(() => {
    const nodes = editor.getSelectedNodes()
    return nodes.length === 1 ? behaviourOwner(editor.graph, nodes[0]) : undefined
  })
  const behaviour = useSceneComputed(() => (owner.value ? readBehaviour(owner.value) : null))

  const control = useSceneComputed<BehaviourControl | null>(() => {
    const current = behaviour.value
    const target = owner.value
    if (!current || !target) return null
    const contract = behaviourContract(current.kind)
    const properties = behaviourProperties(editor.graph, target)
    const options = (types: string[]): VariantDefinitionControl[] =>
      properties
        .filter((definition) => types.includes(definition.type))
        .map((definition) => ({
          id: definition.id,
          name: definition.name,
          values: definition.variantOptions ?? []
        }))
    const values = contract.values.flatMap((value): BehaviourValueControl[] => {
      if (value.type === 'boolean') {
        const binding = booleanBinding(current, value.id)
        return [
          {
            id: value.id,
            type: 'boolean',
            required: value.required,
            propertyId: binding?.propertyId ?? null,
            on: binding?.on,
            off: binding?.off,
            options: options(['VARIANT', 'BOOLEAN'])
          }
        ]
      }
      if (value.type === 'text')
        return [
          {
            id: value.id,
            type: 'text',
            required: value.required,
            propertyId: textBinding(current, value.id) ?? null,
            options: options(['TEXT'])
          }
        ]
      if (value.type === 'number')
        return [
          {
            id: value.id,
            type: 'number',
            ...(current.numbers[value.id] ?? DEFAULT_NUMBER_SETTINGS)
          }
        ]
      return []
    })
    return {
      kind: current.kind,
      values,
      // A slot draws one part, so another part's slot is not offered.
      parts: contract.parts.map((part) => {
        const others = new Set(
          Object.entries(current.parts).flatMap(([id, slot]) => (id === part.id ? [] : [slot]))
        )
        return {
          id: part.id,
          required: part.required,
          propertyId: partBinding(current, part.id) ?? null,
          options: options(['SLOT']).filter((slot) => !others.has(slot.id))
        }
      }),
      states: {
        propertyId: current.states?.propertyId ?? null,
        values: Object.fromEntries(
          INTERACTION_STATES.flatMap((state) => {
            const value = current.states?.[state]
            return value ? [[state, value]] : []
          })
        ),
        options: options(['VARIANT'])
      },
      missing: missingBindings(editor.graph, target, current)
    }
  })

  function update(change: (current: Behaviour) => Behaviour) {
    const target = owner.value
    const current = behaviour.value
    if (target && current) editor.setBehaviour(target.id, change(structuredClone(current)))
  }

  return {
    /** Whether a main component or component set is selected. */
    active: useSceneComputed(() => !!owner.value),
    behaviour: control,
    add: (kind: BehaviourKind) => {
      if (owner.value) editor.setBehaviour(owner.value.id, emptyBehaviour(kind))
    },
    remove: () => {
      if (owner.value) editor.setBehaviour(owner.value.id, null)
    },
    /** Bind a boolean value; a variant property starts with the values that likely mean on and off. */
    bindValue: (valueId: string, propertyId: string) =>
      update((current) => {
        const target = owner.value
        const definition = target
          ? behaviourProperties(editor.graph, target).find((item) => item.id === propertyId)
          : undefined
        current.booleans[valueId] =
          definition?.type === 'VARIANT'
            ? { propertyId, ...guessOnOff(definition.variantOptions ?? []) }
            : { propertyId }
        return current
      }),
    /** Show a text value through a text property. */
    bindText: (valueId: string, propertyId: string) =>
      update((current) => {
        current.texts[valueId] = { propertyId }
        return current
      }),
    mapValue: (valueId: string, mapping: { on: string; off: string }) =>
      update((current) => {
        const binding = booleanBinding(current, valueId)
        if (binding) current.booleans[valueId] = { ...binding, ...mapping }
        return current
      }),
    /** Set a number value's range; a range that cannot be stepped through is ignored. */
    setNumber: (valueId: string, settings: BehaviourNumberSettings) => {
      if (!isNumberRange(settings)) return
      update((current) => {
        current.numbers[valueId] = settings
        return current
      })
    },
    bindPart: (partId: string, propertyId: string) =>
      update((current) => {
        current.parts[partId] = propertyId
        return current
      }),
    /** Add a text layer and text property for a text value, named `name`, and bind it. */
    createText: (valueId: string, name: string) => {
      if (owner.value) editor.addBehaviourText(owner.value.id, valueId, name)
    },
    /** Add an Off/On variant property named `name` for a boolean value, and bind it. */
    createVariant: (valueId: string, name: string) => {
      if (owner.value) editor.addBehaviourVariant(owner.value.id, valueId, name)
    },
    /** Add a slot frame named `name` for a part, and bind it. */
    createPart: (partId: string, name: string) => {
      if (owner.value) editor.addBehaviourPart(owner.value.id, partId, name)
    },
    /** Add a variant for each interaction state, making a lone component a set, and bind them. */
    createStates: () => {
      if (owner.value) editor.addBehaviourStates(owner.value.id)
    },
    /**
     * Draw interaction states with a variant property, its values named like states (Hover,
     * Pressed, …) mapped to them; an empty id stops drawing states.
     */
    bindStates: (propertyId: string) =>
      update((current) => {
        const target = owner.value
        const definition = target
          ? behaviourProperties(editor.graph, target).find((item) => item.id === propertyId)
          : undefined
        if (!definition) delete current.states
        else current.states = guessInteractionStates(propertyId, definition.variantOptions ?? [])
        return current
      }),
    /** Choose the variant value of one interaction state; an empty value unsets it. */
    mapState: (state: InteractionState, value: string) =>
      update((current) => {
        if (!current.states) return current
        current.states = { ...current.states, [state]: value || undefined }
        return current
      })
  }
}
