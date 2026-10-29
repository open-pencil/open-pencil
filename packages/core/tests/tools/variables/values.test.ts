import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

import { createVariable, deleteVariable } from '#core/tools/variables/values'

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

  test('deleting a variable the document lacks reports it', async () => {
    const figma = new FigmaAPI(new SceneGraph())
    expect(await deleteVariable.execute(figma, { id: 'VariableID:9:9' })).toEqual({
      error: 'Variable "VariableID:9:9" not found'
    })
  })
})
