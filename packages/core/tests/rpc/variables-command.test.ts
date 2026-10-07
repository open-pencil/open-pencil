import { describe, expect, test } from 'bun:test'

import { executeRPCCommand, type TokensResult } from '@open-pencil/core/rpc'
import { SceneGraph } from '@open-pencil/scene-graph'

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
      'Unknown variable type: shadow. Use COLOR, FLOAT, STRING, BOOLEAN.'
    )
  })
})
