import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

import { prepareModeEdit } from '#vue/controls/binding-provider/mode-edit'
import { createOpenPencilBindingProvider } from '#vue/controls/binding-provider/open-pencil'
import { prepareBindingEdits } from '#vue/controls/binding-provider/prepare-edits'
import { resolveEffectiveBindingValue } from '#vue/controls/binding-provider/resolution'

test('binding resolution uses node modes and reports mixed resolved values', () => {
  const editor = createEditor()
  const page = editor.graph.getPages()[0]
  if (!page) throw new Error('No page')
  const collection = editor.graph.createCollection('Spacing')
  editor.graph.addMode(collection.id, 'large', 'Large')
  const variable = editor.graph.createVariable('Space', 'FLOAT', collection.id, 8)
  editor.updateVariableValue(variable.id, 'large', 24)
  const a = editor.graph.createNode('RECTANGLE', page.id, {})
  const b = editor.graph.createNode('RECTANGLE', page.id, {
    variableModes: { [collection.id]: 'large' }
  })
  const targets = [a, b].map((node) => ({ nodeId: node.id, path: 'width' }))
  const provider = createOpenPencilBindingProvider(editor, {
    type: 'FLOAT',
    prepareEdit: (e, id, target) =>
      prepareModeEdit(e, id, target, () => e.graph.resolveNumberVariableForNode(target.nodeId, id)),
    resolve: (e, id, target) =>
      target ? e.graph.resolveNumberVariableForNode(target.nodeId, id) : e.resolveNumberVariable(id)
  })
  for (const target of targets) provider.bind(target, variable.id)
  expect(provider.resolve(variable.id, targets[0])).toBe(8)
  expect(provider.resolve(variable.id, targets[1])).toBe(24)
  expect(provider.getState(targets)).toBe('mixed')
  expect(provider.getState(targets.slice(0, 1))).toBe('bound')
  const target = targets[1]
  if (!target) throw new Error('No target')
  const edit = provider.prepareEdit?.(variable.id, target)
  if (!edit) throw new Error('No edit')
  edit.set(32)
  expect(provider.resolve(variable.id, targets[0])).toBe(8)
  expect(provider.resolve(variable.id, targets[1])).toBe(32)

  const aliasCollection = editor.graph.createCollection('Alias values')
  editor.graph.addMode(aliasCollection.id, 'alternate', 'Alternate')
  const alias = editor.graph.createVariable('Alias', 'FLOAT', aliasCollection.id, 4)
  editor.updateVariableValue(alias.id, 'alternate', 64)
  editor.graph.updateNode(b.id, {
    variableModes: { [collection.id]: 'large', [aliasCollection.id]: 'alternate' }
  })
  editor.updateVariableValue(variable.id, 'large', { aliasId: alias.id })
  expect(resolveEffectiveBindingValue(editor, variable.id, target)).toBe(64)
  editor.updateVariableValue(alias.id, 'alternate', { aliasId: variable.id })
  expect(resolveEffectiveBindingValue(editor, variable.id, target)).toBeUndefined()

  delete variable.valuesByMode.large
  expect(provider.getState(targets.slice(1))).toBe('unresolved')
  editor.updateVariableValue(variable.id, 'large', { aliasId: 'missing-alias' })
  expect(provider.getState(targets.slice(1))).toBe('unresolved')
  editor.graph.variables.delete(variable.id)
  expect(provider.getBindingId(target)).toBe(variable.id)
  expect(provider.getBound(target)).toBeUndefined()
  expect(provider.getState(targets)).toBe('unresolved')
  provider.unbind(target)
  expect(provider.getState(targets)).toBe('mixed')
  expect(prepareBindingEdits(provider, targets)).toBeUndefined()
  const other = editor.graph.createVariable('Other', 'FLOAT', collection.id, 12)
  provider.bind(target, other.id)
  editor.graph.variables.delete(other.id)
  expect(provider.getState(targets)).toBe('mixed')
  expect(prepareBindingEdits(provider, targets)).toBeUndefined()
  expect(provider.getBindingId(targets[0] ?? target)).toBe(variable.id)
  expect(provider.getBindingId(target)).toBe(other.id)
})
