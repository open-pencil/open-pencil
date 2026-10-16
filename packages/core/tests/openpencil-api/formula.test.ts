import { expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { compileScript } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'

test('AI scripts author formulas through the same validation as the inspector', async () => {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Tokens')
  graph.createVariable('base', 'FLOAT', collection.id, 4)
  const gap = graph.createVariable('gap', 'FLOAT', collection.id, 0)
  graph.createVariable('enabled', 'BOOLEAN', collection.id, true)
  const visible = graph.createVariable('visible', 'BOOLEAN', collection.id, false)
  const figma = new FigmaAPI(graph)
  const result = await compileScript(`
    return [
      openpencil.setVariableFormula('Tokens', 'gap', '{base} * 2'),
      openpencil.setVariableFormula('Tokens', 'visible', 'NOT {enabled}')
    ]
  `)(figma)
  expect(result).toEqual([8, false])
  expect(graph.resolveVariable(gap.id)).toBe(8)
  expect(graph.resolveVariable(visible.id)).toBe(false)
  await expect(
    compileScript(`openpencil.setVariableFormula('Tokens', 'gap', '1 / 0')`)(figma)
  ).rejects.toThrow()
  expect(graph.resolveVariable(gap.id)).toBe(8)
})


test('script formulas and literals replace CSS metadata only in the edited mode', async () => {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Tokens')
  const gap = graph.createVariable('gap', 'FLOAT', collection.id, 4)
  graph.addMode(collection.id, 'large', 'Large')
  const mode = collection.defaultModeId
  const figma = new FigmaAPI(graph)
  for (const source of ['2 * 3', '12']) {
    gap.expressions = {
      [mode]: { css: '1rem', resolved: 4 },
      large: { css: '2rem', resolved: 32 }
    }
    await compileScript(`openpencil.setVariableFormula('Tokens', 'gap', '${source}')`)(figma)
    expect(gap.expressions).toEqual({ large: { css: '2rem', resolved: 32 } })
  }
})
