import { describe, expect, test } from 'bun:test'

import { executeRPCCommand, type TokensResult, type VariablesResult } from '@open-pencil/core/rpc'
import { SceneGraph } from '@open-pencil/scene-graph'
import { parseVariableFormula } from '@open-pencil/scene-graph/variables'

function graphWithTokens(): SceneGraph {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Theme')
  graph.createVariable('Primary', 'COLOR', collection.id, { r: 1, g: 0, b: 0, a: 1 })
  graph.createVariable('Gap', 'FLOAT', collection.id, 8)
  return graph
}

describe('tokens command', () => {
  test('returns the stylesheet with its filters applied', async () => {
    const result = (await executeRPCCommand(graphWithTokens(), 'tokens', {
      format: 'css',
      type: 'color'
    })) as TokensResult
    expect(result).toEqual({
      css: ':root {\n  --color-primary: #FF0000;\n}\n',
      tokenCount: 1,
      issues: []
    })
  })

  test('writes W3C design token files for the dtcg format', async () => {
    const result = (await executeRPCCommand(graphWithTokens(), 'tokens', {
      format: 'dtcg'
    })) as TokensResult
    expect(result.files?.map((file) => file.path)).toContain('tokens.resolver.json')
  })

  test('rejects an unknown format or type', () => {
    expect(() => executeRPCCommand(graphWithTokens(), 'tokens', { format: 'scss' })).toThrow(
      'Unknown token format: scss. Use css, tailwind, or dtcg.'
    )
    expect(() => executeRPCCommand(graphWithTokens(), 'tokens', { type: 'shadow' })).toThrow(
      'Unknown variable type: shadow'
    )
  })

  test('filters timings and easings by their type', async () => {
    const graph = graphWithTokens()
    const collection = [...graph.variableCollections.values()][0]
    graph.createVariable('Fast', 'TIMING', collection.id, 0.15)
    graph.createVariable('Out', 'EASING', collection.id, { easing: 'OUT_CUBIC' })
    const css = async (type: string) =>
      ((await executeRPCCommand(graph, 'tokens', { format: 'css', type })) as TokensResult).css
    expect(await css('timing')).toBe(':root {\n  --fast: 150ms;\n}\n')
    expect(await css('easing')).toBe(':root {\n  --ease-out: ease-out;\n}\n')
  })
})

describe('variables command', () => {
  test('lists a formula as written, with what it gives', async () => {
    const graph = graphWithTokens()
    const gap = [...graph.variables.values()].find((variable) => variable.name === 'Gap')
    const collection = [...graph.variableCollections.values()][0]
    if (!gap || !collection) throw new Error('Missing token')
    const large = graph.createVariable('Large', 'FLOAT', collection.id, 0)
    large.valuesByMode[collection.defaultModeId] = parseVariableFormula(
      graph,
      large.id,
      collection.defaultModeId,
      '({Gap} * 2)'
    ).value
    const result = (await executeRPCCommand(graph, 'variables', {})) as VariablesResult
    const values = result.collections.flatMap((entry) => entry.variables)
    expect(values.find((variable) => variable.name === 'Large')?.value).toBe('{Gap} * 2 = 16')
  })

  test('lists a timing in milliseconds and an easing by name', async () => {
    const graph = graphWithTokens()
    const collection = [...graph.variableCollections.values()][0]
    graph.createVariable('Fast', 'TIMING', collection.id, 0.15)
    graph.createVariable('Out', 'EASING', collection.id, { easing: 'OUT_CUBIC' })
    const result = (await executeRPCCommand(graph, 'variables', {})) as VariablesResult
    const values = result.collections.flatMap((entry) => entry.variables)
    expect(values.find((variable) => variable.name === 'Fast')?.value).toBe('150ms')
    expect(values.find((variable) => variable.name === 'Out')?.value).toBe('Ease out')
  })
})
