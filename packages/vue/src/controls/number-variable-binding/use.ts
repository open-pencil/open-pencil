import { randomHex } from '@open-pencil/core/random'
import type { VariableCollection } from '@open-pencil/core/scene-graph'

import { useVariableBinding } from '#vue/controls/variable-binding/use'

const FALLBACK_NUMBER_VARIABLE_NAME = 'New number'

export type NumberBindingPath =
  | 'width'
  | 'height'
  | 'minWidth'
  | 'maxWidth'
  | 'minHeight'
  | 'maxHeight'
  | 'cornerRadius'
  | 'topLeftRadius'
  | 'topRightRadius'
  | 'bottomLeftRadius'
  | 'bottomRightRadius'
  | 'itemSpacing'
  | 'counterAxisSpacing'
  | 'paddingTop'
  | 'paddingRight'
  | 'paddingBottom'
  | 'paddingLeft'
  | 'opacity'
  | 'fontSize'

export function useNumberVariableBinding(path: NumberBindingPath) {
  const binding = useVariableBinding({
    type: 'FLOAT',
    path
  })

  function numberCollection(): VariableCollection {
    const existing = binding.store
      .getCollections()
      .find((collection) =>
        collection.variableIds.some(
          (variableId) => binding.store.getVariable(variableId)?.type === 'FLOAT'
        )
      )
    if (existing) return existing

    const collection: VariableCollection = {
      id: `col:${randomHex(8)}`,
      name: 'Numbers',
      modes: [{ modeId: 'default', name: 'Mode 1' }],
      defaultModeId: 'default',
      variableIds: []
    }
    binding.store.addCollection(collection)
    return collection
  }

  function createAndBindVariable(
    nodeId: string,
    value: number,
    name = FALLBACK_NUMBER_VARIABLE_NAME
  ) {
    const collection = numberCollection()
    const id = `var:${randomHex(8)}`
    binding.store.addVariable({
      id,
      name: name.trim() || FALLBACK_NUMBER_VARIABLE_NAME,
      type: 'FLOAT',
      collectionId: collection.id,
      valuesByMode: Object.fromEntries(collection.modes.map((mode) => [mode.modeId, value])),
      description: '',
      hiddenFromPublishing: false
    })
    binding.bindVariable(nodeId, id)
  }

  return {
    ...binding,
    numberVariables: binding.variables,
    createAndBindVariable
  }
}
