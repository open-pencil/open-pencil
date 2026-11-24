import { describe, expect, test } from 'bun:test'

import { cloudMCPCatalog } from '#mcp-catalog/catalog'

describe('Cloud MCP catalog', () => {
  test('lists every tool an MCP client may call, and none that runs code', () => {
    const names = cloudMCPCatalog().map((tool) => tool.name)
    expect(names).toContain('get_page_tree')
    expect(names).toContain('render')
    expect(names).not.toContain('eval')
    expect(new Set(names).size).toBe(names.length)
  })

  test('describes inputs as objects and marks the tools that change the document', () => {
    const catalog = cloudMCPCatalog()
    for (const tool of catalog) expect(tool.inputSchema.type).toBe('object')
    expect(catalog.find((tool) => tool.name === 'get_page_tree')?.mutates).toBe(false)
    expect(catalog.find((tool) => tool.name === 'render')?.mutates).toBe(true)
  })
})
