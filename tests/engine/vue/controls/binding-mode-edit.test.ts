import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

import { prepareModeEdit } from '#vue/controls/binding-provider/mode-edit'
import { createOpenPencilBindingProvider } from '#vue/controls/binding-provider/open-pencil'
import { prepareBindingEdits } from '#vue/controls/binding-provider/prepare-edits'

test('prepared edits retain modes after targets change and undo atomically', () => {
  const editor = createEditor()
  const page = editor.graph.getPages()[0]
  if (!page) throw new Error('No page')
  const collection = editor.graph.createCollection('Spacing')
  editor.graph.addMode(collection.id, 'alternate', 'Alternate')
  const variable = editor.graph.createVariable('Gap', 'FLOAT', collection.id, 8)
  editor.updateVariableValue(variable.id, 'alternate', 8)
  const a = editor.graph.createNode('FRAME', page.id, {})
  const b = editor.graph.createNode('FRAME', page.id, {
    variableModes: { [collection.id]: 'alternate' }
  })
  const provider = createOpenPencilBindingProvider(editor, {
    type: 'FLOAT',
    resolve: (e, id, target) =>
      target
        ? e.graph.resolveNumberVariableForNode(target.nodeId, id)
        : e.resolveNumberVariable(id),
    prepareEdit: (e, id, target) =>
      prepareModeEdit(e, id, target, () => e.graph.resolveNumberVariableForNode(target.nodeId, id))
  })
  const targets = [a, a, b].map((node) => ({ nodeId: node.id, path: 'width' }))
  for (const target of targets) provider.bind(target, variable.id)
  const edits = prepareBindingEdits(provider, targets)
  expect(edits).toHaveLength(2)
  if (!edits) throw new Error('No edits')
  const [first, second] = edits
  if (!first || !second) throw new Error('No edit')
  expect(first.key).not.toBe(second.key)
  editor.graph.updateNode(b.id, { variableModes: {} })
  editor.undo.runBatch('Edit variable', () => {
    first.set(12)
    second.set(12)
  })
  expect(editor.getVariable(variable.id)?.valuesByMode).toEqual({
    [collection.defaultModeId]: 12,
    alternate: 12
  })
  editor.undo.undo()
  expect(editor.getVariable(variable.id)?.valuesByMode).toEqual({
    [collection.defaultModeId]: 8,
    alternate: 8
  })
  second.set(20)
  second.restore?.()
  expect(editor.getVariable(variable.id)?.valuesByMode.alternate).toBe(8)
})
