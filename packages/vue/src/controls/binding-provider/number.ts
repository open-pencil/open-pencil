import type { Editor } from '@open-pencil/core/editor'
import { randomHex } from '@open-pencil/core/random'
import type { VariableCollection } from '@open-pencil/scene-graph'

import { useOpenPencilBindingProvider } from '#vue/controls/binding-provider/open-pencil'
import type { BindingTarget } from '#vue/controls/binding-provider/types'

const FALLBACK_NUMBER_VARIABLE_NAME = 'New number'

function numberCollection(editor: Editor): VariableCollection {
  const existing = editor
    .getCollections()
    .find((collection) =>
      collection.variableIds.some((variableId) => editor.getVariable(variableId)?.type === 'FLOAT')
    )
  if (existing) return existing

  const collection: VariableCollection = {
    id: `col:${randomHex(8)}`,
    name: 'Numbers',
    modes: [{ modeId: 'default', name: 'Mode 1' }],
    defaultModeId: 'default',
    variableIds: []
  }
  editor.addCollection(collection)
  return collection
}

export function createAndBindNumberVariable(
  editor: Editor,
  target: BindingTarget,
  value: number,
  name = FALLBACK_NUMBER_VARIABLE_NAME
) {
  const collection = numberCollection(editor)
  const id = `var:${randomHex(8)}`
  editor.addVariable({
    id,
    name: name.trim() || FALLBACK_NUMBER_VARIABLE_NAME,
    type: 'FLOAT',
    collectionId: collection.id,
    valuesByMode: Object.fromEntries(collection.modes.map((mode) => [mode.modeId, value])),
    description: '',
    hiddenFromPublishing: false
  })
  editor.bindVariable(target.nodeId, target.path, id)
}

function setNumberVariableValue(editor: Editor, variableId: string, value: number) {
  const variable = editor.getVariable(variableId)
  if (!variable) return
  const collection = editor.getCollection(variable.collectionId)
  if (!collection) return
  for (const mode of collection.modes) editor.updateVariableValue(variableId, mode.modeId, value)
}

export function useNumberBindingProvider() {
  return useOpenPencilBindingProvider<number>({
    type: 'FLOAT',
    resolve: (editor, variableId) => editor.resolveNumberVariable(variableId),
    create: createAndBindNumberVariable,
    setValue: setNumberVariableValue
  })
}
