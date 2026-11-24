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

  test('timings take CSS times and easings take a preset or a CSS curve', async () => {
    const graph = new SceneGraph()
    const collection = graph.createCollection('Motion')
    const figma = new FigmaAPI(graph)
    const mode = collection.defaultModeId
    const create = (name: string, type: 'TIMING' | 'EASING', value: string) =>
      createVariable.execute(figma, { name, type, collection_id: collection.id, value })
    expect(await create('fast', 'TIMING', '250ms')).toMatchObject({ valuesByMode: { [mode]: 0.25 } })
    expect(await create('gentle', 'EASING', 'gentle')).toMatchObject({
      valuesByMode: { [mode]: { easing: 'GENTLE_SPRING' } }
    })
    expect(await create('curve', 'EASING', 'cubic-bezier(0.1, 0.2, 0.3, 0.9)')).toMatchObject({
      valuesByMode: {
        [mode]: { easing: 'CUSTOM_CUBIC', bezier: { x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.9 } }
      }
    })
    expect(await create('slow', 'TIMING', 'slow')).toEqual({
      error: '"slow" is not a time such as 250ms or 0.25s'
    })
    expect(graph.variables.size).toBe(3)
  })

  test('deleting a variable the document lacks reports it', async () => {
    const figma = new FigmaAPI(new SceneGraph())
    expect(await deleteVariable.execute(figma, { id: 'VariableID:9:9' })).toEqual({
      error: 'Variable "VariableID:9:9" not found'
    })
  })
})
