import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

import { setNumberVariableValue } from '#vue/controls/binding-provider/number'
import { createOpenPencilBindingProvider } from '#vue/controls/binding-provider/open-pencil'

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
    setValue: setNumberVariableValue,
    resolve: (e, id, target) =>
      target ? e.graph.resolveNumberVariableForNode(target.nodeId, id) : e.resolveNumberVariable(id)
  })
  for (const target of targets) provider.bind(target, variable.id)
  expect(provider.resolve(variable.id, targets[0])).toBe(8)
  expect(provider.resolve(variable.id, targets[1])).toBe(24)
  expect(provider.getState(targets)).toBe('mixed')
  expect(provider.getState(targets.slice(0, 1))).toBe('bound')
  provider.setValue?.(variable.id, 32, targets[1])
  expect(provider.resolve(variable.id, targets[0])).toBe(8)
  expect(provider.resolve(variable.id, targets[1])).toBe(32)
})
