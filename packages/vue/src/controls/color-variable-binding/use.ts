import { useVariableBinding } from '#vue/controls/variable-binding/use'

import { randomHex } from '@open-pencil/core/random'

const FALLBACK_COLOR_VARIABLE_NAME = 'New color'

import type { VariableCollection } from '@open-pencil/core/scene-graph'
import type { Color } from '@open-pencil/core/types'

type ColorBindingKind = 'fills' | 'strokes'

export function useColorVariableBinding(kind: ColorBindingKind) {
  const binding = useVariableBinding({
    type: 'COLOR',
    path: (index) => `${kind}/${index}/color`
  })

  function colorCollection(): VariableCollection {
    const existing = binding.store
      .getCollections()
      .find((collection) =>
        collection.variableIds.some(
          (variableId) => binding.store.getVariable(variableId)?.type === 'COLOR'
        )
      )
    if (existing) return existing

    const collection: VariableCollection = {
      id: `col:${randomHex(8)}`,
      name: 'Colors',
      modes: [{ modeId: 'default', name: 'Mode 1' }],
      defaultModeId: 'default',
      variableIds: []
    }
    binding.store.addCollection(collection)
    return collection
  }

  function createAndBindVariable(
    nodeId: string,
    index: number,
    color: Color,
    name = FALLBACK_COLOR_VARIABLE_NAME
  ) {
    const collection = colorCollection()
    const id = `var:${randomHex(8)}`
    binding.store.addVariable({
      id,
      name: name.trim() || FALLBACK_COLOR_VARIABLE_NAME,
      type: 'COLOR',
      collectionId: collection.id,
      valuesByMode: Object.fromEntries(collection.modes.map((mode) => [mode.modeId, color])),
      description: '',
      hiddenFromPublishing: false
    })
    binding.bindVariable(nodeId, id, index)
  }

  return {
    ...binding,
    colorVariables: binding.variables,
    bindVariable: (nodeId: string, index: number, variableId: string) =>
      binding.bindVariable(nodeId, variableId, index),
    unbindVariable: (nodeId: string, index: number) => binding.unbindVariable(nodeId, index),
    createAndBindVariable
  }
}
