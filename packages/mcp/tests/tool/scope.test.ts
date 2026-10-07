import { describe, expect, test } from 'bun:test'

import {
  isToolEnabled,
  parseToolScope,
  SELECTION_SCOPE_TOOLS,
  type ToolDescriptor
} from '@open-pencil/mcp/tools'

function tool(name: string): ToolDescriptor {
  return {
    name,
    description: name,
    effect: 'read',
    availability: 'default',
    capabilities: ['document:read'],
    enabled: true
  }
}

describe('MCP tool scope', () => {
  test('reads the scope, defaulting to the document', () => {
    expect(parseToolScope(undefined)).toBe('document')
    expect(parseToolScope('selection')).toBe('selection')
    expect(parseToolScope(' ')).toBe('document')
    expect(() => parseToolScope('page')).toThrow(/OPENPENCIL_MCP_SCOPE/)
  })

  test('keeps only the selection tools in selection scope', () => {
    const policy = { allowEval: false, disabledTools: ['describe'], scope: 'selection' as const }
    expect(isToolEnabled(tool('get_node'), policy)).toBe(true)
    expect(isToolEnabled(tool('delete_node'), policy)).toBe(false)
    expect(isToolEnabled(tool('list_documents'), policy)).toBe(false)
    // Turning a tool off still applies inside the scope.
    expect(isToolEnabled(tool('describe'), policy)).toBe(false)
    expect(Object.keys(SELECTION_SCOPE_TOOLS)).toContain('export_image')
  })
})
