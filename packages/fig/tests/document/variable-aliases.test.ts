import { expect, test } from 'bun:test'

import { validateVariableAliases } from '#fig/document/variable-aliases'

import { SceneGraph } from '@open-pencil/scene-graph'

test('reports missing targets, incompatible types and potential alias cycles without mutation', () => {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Tokens')
  const first = graph.createVariable('First', 'FLOAT', collection.id, 1)
  const second = graph.createVariable('Second', 'FLOAT', collection.id, 2)
  const text = graph.createVariable('Text', 'STRING', collection.id, 'value')
  const mode = collection.defaultModeId
  first.valuesByMode = {
    [mode]: { aliasId: second.id },
    missing: { aliasId: 'absent' },
    wrong: { aliasId: text.id }
  }
  second.valuesByMode = { [mode]: { aliasId: first.id } }
  const before = structuredClone([...graph.variables.values()])
  expect(
    validateVariableAliases(graph)
      .map((item) => item.reason)
      .sort()
  ).toEqual(['missing-target', 'potential-cycle', 'potential-cycle', 'type-mismatch'])
  expect([...graph.variables.values()]).toEqual(before)
})
