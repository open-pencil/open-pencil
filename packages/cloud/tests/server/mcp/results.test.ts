import { describe, expect, test } from 'bun:test'

import { designToolResult } from '#cloud/server/mcp/results'

describe('design tool results', () => {
  test('answers an image with what else the tool said about it', () => {
    const result = designToolResult({ base64: 'AA==', mimeType: 'image/png', changedPixels: 3 })
    expect(result.content[0]).toEqual({ type: 'image', data: 'AA==', mimeType: 'image/png' })
    expect(result.content[1]).toMatchObject({ type: 'text' })
    expect(JSON.stringify(result.content[1])).toContain('changedPixels')
  })

  test('answers a bare image alone', () => {
    expect(designToolResult({ base64: 'AA==', mimeType: 'image/png' }).content).toHaveLength(1)
  })
})
