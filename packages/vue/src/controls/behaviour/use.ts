import {
  behaviourContract,
  behaviourOwner,
  behaviourProperties,
  booleanBinding,
  DEFAULT_NUMBER_SETTINGS,
  emptyBehaviour,
  missingBindings,
  readBehaviour,
  type Behaviour,
  type BehaviourKind,
  type BehaviourNumberSettings
} from '@open-pencil/core/behaviours'

import type { VariantDefinitionControl } from '#vue/controls/component-props/authoring'
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
    const contract = current && behaviourContract(current.kind)
    if (!current || !target || !contract) return null
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
      parts: contract.parts.map((part) => ({
        id: part.id,
        required: part.required,
        propertyId: current.parts[part.id] ?? null,
        options: options(['SLOT'])
      })),
      missing: missingBindings(editor.graph, target, current).length
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
    /** Bind a boolean value; a variant property starts with its first two values as on and off. */
    bindValue: (valueId: string, propertyId: string) =>
      update((current) => {
        const target = owner.value
        const definition = target
          ? behaviourProperties(editor.graph, target).find((item) => item.id === propertyId)
          : undefined
        const [on, off] = definition?.variantOptions ?? []
        current.booleans[valueId] = { propertyId, on, off }
        return current
      }),
    mapValue: (valueId: string, mapping: { on: string; off: string }) =>
      update((current) => {
        const binding = booleanBinding(current, valueId)
        if (binding) current.booleans[valueId] = { ...binding, ...mapping }
        return current
      }),
    setNumber: (valueId: string, settings: BehaviourNumberSettings) =>
      update((current) => {
        current.numbers[valueId] = settings
        return current
      }),
    bindPart: (partId: string, propertyId: string) =>
      update((current) => {
        current.parts[partId] = propertyId
        return current
      })
  }
}
