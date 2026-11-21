import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

import { deleteCollection } from '#core/tools/variables/collections'
import { createVariable, deleteVariable, setVariable } from '#core/tools/variables/values'

function libraryVariable() {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Tokens')
  collection.key = 'library-collection'
  const variable = graph.createVariable('gap', 'FLOAT', collection.id, 8)
  variable.key = 'library-variable'
  return { graph, collection, variable, figma: new FigmaAPI(graph) }
}

describe('variable value tools', () => {
  test('a value the variable cannot hold creates no variable', async () => {
    const graph = new SceneGraph()
    const collection = graph.createCollection('Tokens')
    const figma = new FigmaAPI(graph)
    const args = { name: 'gap', type: 'FLOAT' as const, collection_id: collection.id }
    expect(await createVariable.execute(figma, { ...args, value: 'wide' })).toEqual({
      error: '"wide" is not a number'
    })
    expect(graph.variables.size).toBe(0)
    expect(await createVariable.execute(figma, { ...args, value: '8' })).toMatchObject({
      name: 'gap',
      valuesByMode: { [collection.defaultModeId]: 8 }
    })
  })

  test('tools pass on the plugin api refusal for a library variable and change nothing', () => {
    const { graph, collection, variable, figma } = libraryVariable()
    const mode = collection.defaultModeId

    expect(() => setVariable.execute(figma, { id: variable.id, mode, value: '16' })).toThrow(
      'in setValueForMode: Cannot edit a remote variable'
    )
    expect(() => deleteVariable.execute(figma, { id: variable.id })).toThrow(
      'in remove: Cannot edit a remote variable'
    )
    expect(() => deleteCollection.execute(figma, { id: collection.id })).toThrow(
      'in remove: Cannot edit a remote variable collection'
    )
    expect(graph.variables.get(variable.id)?.valuesByMode[mode]).toBe(8)
    expect(graph.variableCollections.has(collection.id)).toBe(true)
  })

  test('deleting a variable the document lacks reports it', async () => {
    const figma = new FigmaAPI(new SceneGraph())
    expect(await deleteVariable.execute(figma, { id: 'VariableID:9:9' })).toEqual({
      error: 'Variable "VariableID:9:9" not found'
    })
  })
})
