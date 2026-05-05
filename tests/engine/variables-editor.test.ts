import { describe, expect, test } from 'bun:test'
import { ref } from 'vue'

import { createVariableCollectionActions, createVariableValueActions } from '#vue/variables/helpers'

import type { Editor } from '@open-pencil/core/editor'
import type { Variable, VariableCollection } from '@open-pencil/core/scene-graph'

function createEditorHarness() {
  const collections = new Map<string, VariableCollection>()
  const variables = new Map<string, Variable>()
  const collection: VariableCollection = {
    id: 'col:test',
    name: 'Test',
    modes: [
      { modeId: 'default', name: 'Default' },
      { modeId: 'dark', name: 'Dark' }
    ],
    defaultModeId: 'default',
    variableIds: []
  }
  collections.set(collection.id, collection)
  const editor = {
    addCollection(item: VariableCollection) {
      collections.set(item.id, item)
    },
    renameCollection(id: string, name: string) {
      const item = collections.get(id)
      if (item) item.name = name
    },
    addVariable(item: Variable) {
      variables.set(item.id, item)
      collections.get(item.collectionId)?.variableIds.push(item.id)
    },
    removeVariable(id: string) {
      variables.delete(id)
    },
    renameVariable(id: string, name: string) {
      const item = variables.get(id)
      if (item) item.name = name
    },
    updateVariableValue(id: string, modeId: string, value: unknown) {
      const item = variables.get(id)
      if (item) item.valuesByMode[modeId] = value as never
    },
    getVariable(id: string) {
      return variables.get(id)
    }
  } as Editor

  return { editor, collection, collections, variables }
}

describe('variables editor helpers', () => {
  test('creates variables with type-specific default values for every mode', () => {
    const { editor, collection, variables } = createEditorHarness()
    const actions = createVariableValueActions(editor, () => collection)

    actions.addVariable('COLOR')
    actions.addVariable('FLOAT')
    actions.addVariable('STRING')
    actions.addVariable('BOOLEAN')

    const created = [...variables.values()]
    expect(created.map((item) => item.type)).toEqual(['COLOR', 'FLOAT', 'STRING', 'BOOLEAN'])
    expect(created.map((item) => item.name)).toEqual([
      'New color',
      'New number',
      'New text',
      'New boolean'
    ])
    expect(created.map((item) => item.valuesByMode.default)).toEqual([
      { r: 0, g: 0, b: 0, a: 1 },
      0,
      '',
      false
    ])
    expect(created.map((item) => item.valuesByMode.dark)).toEqual([
      { r: 0, g: 0, b: 0, a: 1 },
      0,
      '',
      false
    ])
  })

  test('parses edited values by variable type', () => {
    const { editor, collection } = createEditorHarness()
    const actions = createVariableValueActions(editor, () => collection)
    const variable = {
      id: 'var:bool',
      name: 'Flag',
      type: 'BOOLEAN',
      collectionId: collection.id,
      valuesByMode: { default: false },
      description: '',
      hiddenFromPublishing: false
    } satisfies Variable

    expect(actions.parseVariableValue(variable, 'TRUE')).toBe(true)
    expect(actions.parseVariableValue(variable, 'false')).toBe(false)
    expect(actions.parseVariableValue({ ...variable, type: 'FLOAT' }, '12.5')).toBe(12.5)
    expect(actions.parseVariableValue({ ...variable, type: 'STRING' }, 'hello')).toBe('hello')
  })

  test('creates and activates new collections', () => {
    const { editor, collections } = createEditorHarness()
    const activeCollectionId = ref('')
    const actions = createVariableCollectionActions(editor, activeCollectionId)

    actions.addCollection()

    expect(activeCollectionId.value).toStartWith('col:')
    expect(collections.get(activeCollectionId.value)?.name).toBe('New collection')
  })
})
