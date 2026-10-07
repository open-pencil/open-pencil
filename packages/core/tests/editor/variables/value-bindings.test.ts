import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { SceneGraph } from '@open-pencil/scene-graph'

function boundText() {
  const graph = new SceneGraph()
  const copy = graph.createCollection('Copy')
  const french = graph.createMode(copy.id, 'French') ?? ''
  const label = graph.createVariable('Button/Label', 'STRING', copy.id, 'Save')
  label.valuesByMode[french] = 'Enregistrer'
  const shown = graph.createVariable('Button/Shown', 'BOOLEAN', copy.id, true)
  shown.valuesByMode[french] = false
  const page = graph.getPages()[0].id
  const text = graph.createNode('TEXT', page, {
    text: 'Save',
    boundVariables: { text: label.id, visible: shown.id }
  })
  return { editor: createEditor({ graph }), copy, french, label, text }
}

test('text bound to a variable follows an edited value and its undo', () => {
  const { editor, copy, label, text } = boundText()

  editor.updateVariableValue(label.id, copy.defaultModeId, 'Save changes')
  expect(text.text).toBe('Save changes')

  editor.undo.undo()
  expect(text.text).toBe('Save')
})

test('bound text and visibility follow the mode the collection shows', () => {
  const { editor, copy, french, text } = boundText()

  editor.setActiveMode(copy.id, french)

  expect(text.text).toBe('Enregistrer')
  expect(text.visible).toBe(false)
})

test('bound text follows a mode set on the layer', () => {
  const { editor, copy, french, text } = boundText()

  editor.updateNodeWithUndo(text.id, { variableModes: { [copy.id]: french } }, 'Set mode')

  expect(text.text).toBe('Enregistrer')
})
