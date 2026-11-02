import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { FigmaAPI } from '@lawha/core/figma-api'
import { compileScript } from '@lawha/core/tools'
import { SceneGraph } from '@lawha/scene-graph'

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
      lawha.setVariableFormula('Tokens', 'gap', '{base} * 2'),
      lawha.setVariableFormula('Tokens', 'visible', 'not {enabled}'),
      lawha.setVariableFormula('Tokens', 'visible', '{gap} > 6 and {enabled}')
    ]
  `)(figma)
  expect(result).toEqual([8, false, true])
  expect(graph.resolveVariable(gap.id)).toBe(8)
  expect(graph.resolveVariable(visible.id)).toBe(true)
  await expect(
    compileScript(`lawha.setVariableFormula('Tokens', 'gap', '1 / 0')`)(figma)
  ).rejects.toThrow()
  expect(graph.resolveVariable(gap.id)).toBe(8)
})

test('a mode’s CSS expression outlives a script formula and records a script number', async () => {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Tokens')
  graph.createVariable('base', 'FLOAT', collection.id, 4)
  const gap = graph.createVariable('gap', 'FLOAT', collection.id, 16)
  graph.addMode(collection.id, 'large', 'Large')
  gap.valuesByMode.large = 32
  const mode = collection.defaultModeId
  gap.expressions = {
    [mode]: { css: '1rem', resolved: 16 },
    large: { css: '2rem', resolved: 32 }
  }
  const figma = new FigmaAPI(graph)
  await compileScript(`lawha.setVariableFormula('Tokens', 'gap', '{base} * 4')`)(figma)
  expect(gap.expressions).toEqual({ [mode]: { css: '1rem' }, large: { css: '2rem', resolved: 32 } })
  expectDefined(figma.variables.getVariableById(gap.id)).setValueForMode('large', 40)
  expect(gap.expressions).toEqual({ [mode]: { css: '1rem' }, large: { css: '2rem', resolved: 40 } })
})
