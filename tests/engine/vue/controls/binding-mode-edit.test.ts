import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

import { prepareModeEdit } from '#vue/controls/binding-provider/mode-edit'
import { createOpenPencilBindingProvider } from '#vue/controls/binding-provider/open-pencil'
import { prepareBindingEdits } from '#vue/controls/binding-provider/prepare-edits'
import { resolveEffectiveBindingValue } from '#vue/controls/binding-provider/resolution'

test('editing an alias captures the bound mode without mutating its shared source', () => {
  const editor = createEditor()
  const page = editor.graph.getPages()[0]
  if (!page) throw new Error('No page')
  const collection = editor.graph.createCollection('Tokens')
  const source = editor.graph.createVariable('Shared', 'FLOAT', collection.id, 8)
  const alias = editor.graph.createVariable('Local', 'FLOAT', collection.id, 0)
  const original = { aliasId: source.id }
  editor.updateVariableValue(alias.id, collection.defaultModeId, original)
  const node = editor.graph.createNode('RECTANGLE', page.id, {})
  const target = { nodeId: node.id, path: 'width' }
  const edit = prepareModeEdit<number>(editor, alias.id, target, () => {
    const value = resolveEffectiveBindingValue(editor, alias.id, target)
    return typeof value === 'number' ? value : undefined
  })
  if (!edit) throw new Error('No edit')
  expect(edit.value).toBe(8)
  editor.undo.runBatch('Edit local token', () => edit.set(16))
  expect(editor.getVariable(alias.id)?.valuesByMode[collection.defaultModeId]).toBe(16)
  expect(editor.getVariable(source.id)?.valuesByMode[collection.defaultModeId]).toBe(8)
  editor.undo.undo()
  expect(editor.getVariable(alias.id)?.valuesByMode[collection.defaultModeId]).toEqual(original)
  edit.set(24)
  edit.restore()
  expect(editor.getVariable(alias.id)?.valuesByMode[collection.defaultModeId]).toEqual(original)
  expect(editor.getVariable(source.id)?.valuesByMode[collection.defaultModeId]).toBe(8)
})

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
