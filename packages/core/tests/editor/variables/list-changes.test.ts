import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { SceneGraph } from '@open-pencil/scene-graph'

/** A layer saved at 24 while its binding resolves to 40, as layers in imported files can be. */
function drifted() {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Size')
  const size = graph.createVariable('Icon/Large', 'FLOAT', collection.id, 40)
  const avatar = graph.createNode('FRAME', graph.getPages()[0].id, {
    width: 24,
    height: 24,
    boundVariables: { width: size.id }
  })
  return { editor: createEditor({ graph }), collection, size, avatar }
}

test('adding, copying, and reordering variables leaves bound layers as saved', () => {
  const { editor, collection, size, avatar } = drifted()
  const added = 'var:added'

  editor.addVariable({
    id: added,
    name: 'New number',
    type: 'FLOAT',
    collectionId: collection.id,
    valuesByMode: { [collection.defaultModeId]: 0 },
    description: '',
    hiddenFromPublishing: false
  })
  editor.duplicateVariable(size.id, 'Icon/Large copy')
  editor.setVariableOrder(collection.id, [added, size.id])
  editor.undo.undo()
  editor.undo.undo()
  editor.undo.undo()

  expect(avatar.width).toBe(24)
})

test('a value edit resolves the layers bound to it', () => {
  const { editor, collection, size, avatar } = drifted()

  editor.updateVariableValue(size.id, collection.defaultModeId, 48)

  expect(avatar.width).toBe(48)
})

test('a value edit leaves layers bound to other variables as saved', () => {
  const { editor, collection, avatar } = drifted()
  const gap = editor.graph.createVariable('Gap', 'FLOAT', collection.id, 8)

  editor.updateVariableValue(gap.id, collection.defaultModeId, 12)

  expect(avatar.width).toBe(24)
})

test('switching the mode of a collection resolves every layer bound to its variables', () => {
  const { editor, collection, avatar } = drifted()

  editor.setActiveMode(collection.id, collection.defaultModeId)

  expect(avatar.width).toBe(40)
})

test('renaming or reordering variables refreshes the views and leaves the canvas as drawn', () => {
  const { editor, collection, size } = drifted()
  const gap = editor.graph.createVariable('Gap', 'FLOAT', collection.id, 8)
  const { sceneVersion, canvasVersion } = editor.state

  editor.renameVariable(size.id, 'Icon/Big')
  editor.setVariableOrder(collection.id, [gap.id, size.id])
  editor.updateVariableToken(size.id, { codeSyntax: { WEB: 'var(--icon-big)' } })

  expect(editor.state.sceneVersion).toBeGreaterThan(sceneVersion)
  expect(editor.state.canvasVersion).toBe(canvasVersion)

  editor.updateVariableValue(size.id, collection.defaultModeId, 48)
  expect(editor.state.canvasVersion).toBeGreaterThan(canvasVersion)
})
