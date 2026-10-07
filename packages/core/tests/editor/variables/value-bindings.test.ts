import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createEditor } from '@open-pencil/core/editor'
import { SceneGraph, setInstanceOverride } from '@open-pencil/scene-graph'

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

test('text and visibility an instance overrides keep their own values', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const copy = graph.createCollection('Copy')
  const label = graph.createVariable('Label', 'STRING', copy.id, 'Save')
  const shown = graph.createVariable('Shown', 'BOOLEAN', copy.id, true)
  const button = graph.createNode('COMPONENT', page)
  graph.createNode('TEXT', button.id, {
    text: 'Save',
    boundVariables: { text: label.id, visible: shown.id }
  })
  const placed = expectDefined(graph.createInstance(button.id, page))
  const layer = expectDefined(graph.getNode(placed.childIds[0]))
  const editor = createEditor({ graph })

  // Typing in the layer records its text as the instance's own, as the text editor does.
  setInstanceOverride(placed.instanceOverrides, placed.id, layer.id, 'text', 'Keep')
  graph.updateNode(layer.id, { text: 'Keep' })
  editor.toggleNodeVisibility(layer.id)

  editor.updateVariableValue(label.id, copy.defaultModeId, 'Save changes')
  editor.updateVariableValue(shown.id, copy.defaultModeId, true)

  expect(layer.text).toBe('Keep')
  expect(layer.visible).toBe(false)
})
