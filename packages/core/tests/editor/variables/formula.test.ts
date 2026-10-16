import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { SceneGraph, parseVariableFormula } from '@open-pencil/scene-graph'

import {
  captureClipboardVariables,
  importClipboardVariables
} from '#core/editor/clipboard/variables'
import { deserializeSceneGraph, serializeSceneGraph } from '#core/kiwi/fig/parse/transfer'

test('numeric and Boolean formulas update 100 instances, layout, undo, clipboard and recovery', () => {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Tokens')
  const mode = collection.defaultModeId
  const base = graph.createVariable('base', 'FLOAT', collection.id, 4)
  const gap = graph.createVariable('gap', 'FLOAT', collection.id, 8)
  const enabled = graph.createVariable('enabled', 'BOOLEAN', collection.id, true)
  const visible = graph.createVariable('visible', 'BOOLEAN', collection.id, true)
  gap.valuesByMode[mode] = parseVariableFormula(graph, gap.id, mode, '{base} * 2').value
  visible.valuesByMode[mode] = parseVariableFormula(
    graph,
    visible.id,
    mode,
    '{enabled} AND true'
  ).value
  const component = graph.createNode('COMPONENT', graph.getPages()[0].id, {
    layoutMode: 'HORIZONTAL',
    itemSpacing: 8,
    primaryAxisSizing: 'HUG',
    boundVariables: { itemSpacing: gap.id, visible: visible.id }
  })
  graph.createNode('FRAME', component.id, { width: 20, height: 10 })
  graph.createNode('FRAME', component.id, { width: 20, height: 10 })
  const instances = Array.from({ length: 100 }, () => {
    const instance = graph.createInstance(component.id, graph.getPages()[0].id)
    if (!instance) throw new Error('Missing instance')
    return instance.id
  })
  const editor = createEditor({ graph })
  editor.updateVariableValue(base.id, mode, 6)
  for (const id of instances) {
    expect(graph.getNode(id)?.itemSpacing).toBe(12)
    expect(graph.getNode(id)?.width).toBe(52)
  }
  editor.updateVariableValue(enabled.id, mode, false)
  for (const id of instances) expect(graph.getNode(id)?.visible).toBe(false)
  editor.undo.undo()
  for (const id of instances) expect(graph.getNode(id)?.visible).toBe(true)
  editor.undo.undo()
  for (const id of instances) expect(graph.getNode(id)?.itemSpacing).toBe(8)
  editor.undo.redo()
  for (const id of instances) expect(graph.getNode(id)?.itemSpacing).toBe(12)
  const clipboard = captureClipboardVariables(graph, [component])
  expect(clipboard.variables).toHaveLength(4)
  const destination = new SceneGraph()
  const transfer = importClipboardVariables(destination, clipboard)
  transfer.apply()
  const copyId = transfer.variableIds.get(gap.id) ?? ''
  expect(destination.resolveVariable(copyId)).toBe(12)
  const recovered = deserializeSceneGraph(serializeSceneGraph(destination))
  expect(recovered.resolveVariable(copyId)).toBe(12)
})
