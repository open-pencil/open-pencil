import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { SceneGraph } from '@open-pencil/scene-graph'

import { serializeSceneGraph, deserializeSceneGraph } from '#core/kiwi/fig/parse/transfer'

function setup(importedInstance = false) {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Spacing')
  const variable = graph.createVariable('Padding', 'FLOAT', collection.id, 10)
  const alias = graph.createVariable('Alias', 'FLOAT', collection.id, { aliasId: variable.id })
  const frame = graph.createNode(importedInstance ? 'INSTANCE' : 'FRAME', graph.getPages()[0].id, {
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    paddingLeft: 2.5,
    boundVariables: { paddingLeft: alias.id },
    variableBindingScales: { paddingLeft: 0.25 }
  })
  if (importedInstance) frame.source.format = 'fig'
  const child = graph.createNode('RECTANGLE', frame.id, { width: 5, height: 5 })
  return { graph, collection, variable, alias, frame, child, editor: createEditor({ graph }) }
}

test('token edits through aliases reflow scaled layout and undo without changing binding units', () => {
  const { editor, collection, variable, frame, child } = setup()
  editor.updateVariableValue(variable.id, collection.defaultModeId, 20)
  expect(frame.paddingLeft).toBe(5)
  expect(child.x).toBe(5)
  expect(frame.width).toBe(10)
  editor.undo.undo()
  expect(frame.paddingLeft).toBe(2.5)
  expect(child.x).toBe(2.5)
  editor.undo.redo()
  expect(frame.paddingLeft).toBe(5)
  expect(frame.variableBindingScales).toEqual({ paddingLeft: 0.25 })
})

test('a binding edit recomputes the saved Hug size of a placed instance root', () => {
  const { editor, variable, collection, frame, child } = setup(true)
  editor.updateVariableValue(variable.id, collection.defaultModeId, 20)
  expect(frame.width).toBe(10)
  expect(child.x).toBe(5)
  editor.undo.undo()
  expect(frame.width).toBe(7.5)
  expect(child.x).toBe(2.5)
})

test('active and inherited explicit modes use the same numeric conversion', () => {
  const { graph, editor, collection, variable, frame, child } = setup()
  graph.addMode(collection.id, 'alternate', 'Alternate')
  editor.updateVariableValue(variable.id, 'alternate', 40)
  expect(frame.paddingLeft).toBe(2.5)
  editor.setActiveMode(collection.id, 'alternate')
  expect(frame.paddingLeft).toBe(10)
  editor.updateNodeWithUndo(graph.getPages()[0].id, {
    variableModes: { [collection.id]: collection.defaultModeId }
  })
  expect(frame.paddingLeft).toBe(2.5)
  expect(child.x).toBe(2.5)
  editor.undo.undo()
  expect(frame.paddingLeft).toBe(10)
})

test('portable graph transfer retains conversions and accepts older snapshots', () => {
  const { graph, frame, variable, collection } = setup()
  graph.updateNode(frame.id, { variableAssignmentScales: { paddingLeft: 0.5 } })
  const data = structuredClone(serializeSceneGraph(graph))
  const restored = deserializeSceneGraph(data)
  createEditor({ graph: restored }).updateVariableValue(variable.id, collection.defaultModeId, 20)
  expect(restored.getNode(frame.id)?.paddingLeft).toBe(5)
  expect(graph.getNode(frame.id)?.paddingLeft).toBe(2.5)
  createEditor({ graph: restored }).bindVariable(frame.id, 'paddingLeft', variable.id)
  expect(restored.getNode(frame.id)?.paddingLeft).toBe(10)
  for (const [, node] of data.nodes) {
    Reflect.deleteProperty(node, 'variableBindingScales')
    Reflect.deleteProperty(node, 'variableAssignmentScales')
  }
  const legacy = deserializeSceneGraph(data)
  expect(legacy.getNode(frame.id)?.variableBindingScales).toEqual({})
  expect(legacy.getNode(frame.id)?.variableAssignmentScales).toEqual({})
})

test('clones isolate conversion metadata and unbinding undo restores it', () => {
  const { graph, editor, frame, alias, collection, variable } = setup()
  frame.variableAssignmentScales = { paddingLeft: 0.5 }
  const clone = graph.cloneTree(frame.id, graph.getPages()[0].id)
  if (!clone) throw new Error('Missing clone')
  clone.variableAssignmentScales.paddingLeft = 0.75
  expect(frame.variableAssignmentScales.paddingLeft).toBe(0.5)
  clone.variableBindingScales.paddingLeft = 0.5
  expect(frame.variableBindingScales.paddingLeft).toBe(0.25)
  editor.unbindVariable(frame.id, 'paddingLeft')
  expect(frame.variableBindingScales).toEqual({})
  editor.undo.undo()
  expect(frame.boundVariables.paddingLeft).toBe(alias.id)
  expect(frame.variableBindingScales.paddingLeft).toBe(0.25)
  editor.updateVariableValue(variable.id, collection.defaultModeId, 20)
  expect(frame.paddingLeft).toBe(5)
  expect(clone.paddingLeft).toBe(10)
})
