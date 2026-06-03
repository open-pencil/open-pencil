import { describe, expect, test } from 'bun:test'

import { MAX_RESULT_BYTES, ok } from '#mcp/result'

describe('MCP result formatting', () => {
  test('returns structured errors for oversized text results', () => {
    const result = ok({ payload: 'x'.repeat(MAX_RESULT_BYTES) }, 'large_tool')

    expect(result.isError).toBe(true)
    expect(result.content[0].type).toBe('text')
    if (result.content[0].type !== 'text') throw new Error('Expected text result')
    const error = JSON.parse(result.content[0].text) as { error: string }
    expect(error.error).toContain('large_tool')
    expect(error.error).toContain('too large')
  })
})
