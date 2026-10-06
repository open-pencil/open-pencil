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
