import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

import { bindVariable } from '#core/tools/variables/bindings'
import { listVariables } from '#core/tools/variables/read'
import { createVariable } from '#core/tools/variables/values'

async function setup() {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Tokens')
  const figma = new FigmaAPI(graph)
  const rect = figma.createRectangle()
  const variable = (await createVariable.execute(figma, {
    name: 'radius/card',
    type: 'FLOAT',
    collection_id: collection.id,
    value: '8'
  })) as { id: string }
  return { graph, figma, rect, variable }
}

describe('bind_variable', () => {
  test('a null variable unbinds the field', async () => {
    const { graph, figma, rect, variable } = await setup()
    const field = 'cornerRadius'
    await bindVariable.execute(figma, { node_id: rect.id, field, variable_id: variable.id })
    expect(graph.getNode(rect.id)?.boundVariables[field]).toBeDefined()

    expect(
      await bindVariable.execute(figma, { node_id: rect.id, field, variable_id: null })
    ).toEqual({ unbound: true, node_id: rect.id, field })
    expect(graph.getNode(rect.id)?.boundVariables[field]).toBeUndefined()
    expect(
      await bindVariable.execute(figma, { node_id: rect.id, field, variable_id: null })
    ).toEqual({ error: `No binding found for field "${field}" on node "${rect.id}"` })
  })
})

describe('list_variables', () => {
  test('a query keeps the variables whose names contain it, in any case', async () => {
    const { figma } = await setup()
    expect(await listVariables.execute(figma, { query: 'CARD' })).toMatchObject({
      count: 1,
      variables: [{ name: 'radius/card' }]
    })
    expect(await listVariables.execute(figma, { query: 'button' })).toEqual({
      count: 0,
      variables: []
    })
  })
})
