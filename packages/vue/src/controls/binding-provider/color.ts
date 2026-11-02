import type { Editor } from '@lawha/core'
import type { VariableCollection } from '@lawha/scene-graph'
import type { Color } from '@lawha/scene-graph/primitives'
import { randomHex } from '@lawha/scene-graph/random'

import { useLawhaBindingProvider } from '#vue/controls/binding-provider/lawha'
import type { BindingTarget } from '#vue/controls/binding-provider/types'

import { prepareModeEdit } from './mode-edit'
import { resolveEffectiveBindingValue } from './resolution'

const FALLBACK_COLOR_VARIABLE_NAME = 'New color'

function colorCollection(editor: Editor): VariableCollection {
  const existing = editor
    .getCollections()
    .find((collection) =>
      collection.variableIds.some((variableId) => editor.getVariable(variableId)?.type === 'COLOR')
    )
  if (existing) return existing

  const collection: VariableCollection = {
    id: `col:${randomHex(8)}`,
    name: 'Colors',
    modes: [{ modeId: 'default', name: 'Mode 1' }],
    defaultModeId: 'default',
    variableIds: []
  }
  editor.addCollection(collection)
  return collection
}

export function createAndBindColorVariable(
  editor: Editor,
  target: BindingTarget,
  value: Color,
  name = FALLBACK_COLOR_VARIABLE_NAME
) {
  const collection = colorCollection(editor)
  const id = `var:${randomHex(8)}`
  editor.addVariable({
    id,
    name: name.trim() || FALLBACK_COLOR_VARIABLE_NAME,
    type: 'COLOR',
    collectionId: collection.id,
    valuesByMode: Object.fromEntries(
      collection.modes.map((mode) => [mode.modeId, structuredClone(value)])
    ),
    description: '',
    hiddenFromPublishing: false
  })
  editor.bindVariable(target.nodeId, target.path, id)
}

function resolveColor(editor: Editor, id: string, target?: BindingTarget) {
  const value = target
    ? resolveEffectiveBindingValue(editor, id, target)
    : editor.resolveColorVariable(id)
  return value && typeof value === 'object' && 'r' in value ? value : undefined
}

export function useColorBindingProvider() {
  return useLawhaBindingProvider<Color>({
    types: ['COLOR'],
    resolve: resolveColor,
    prepareEdit: (editor, id, target) =>
      prepareModeEdit(editor, id, target, () => resolveColor(editor, id, target)),
    create: createAndBindColorVariable
  })
}
