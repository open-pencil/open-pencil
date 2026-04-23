import { describe, expect, test } from 'bun:test'

import { buildAutomationCommandSpec } from '../../src/automation/spawn-mcp'

describe('buildAutomationCommandSpec', () => {
  test('uses bare command on non-Windows platforms', () => {
    expect(buildAutomationCommandSpec('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toEqual({
      name: 'openpencil-mcp-http',
      args: []
    })
  })

  test('uses cmd wrapper on Windows', () => {
    expect(buildAutomationCommandSpec('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toEqual({
      name: 'openpencil-mcp-http-cmd',
      args: ['/d', '/c', 'openpencil-mcp-http']
    })
  })
})
