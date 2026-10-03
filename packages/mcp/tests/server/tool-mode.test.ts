import { describe, expect, test } from 'bun:test'

import { createToolDescriptors } from '#mcp/tool/manifest'
import { applyToolPolicy, parseToolMode, SELECTION_CONTEXT_TOOLS } from '#mcp/tool/policy'
import { imageToolResult } from '#mcp/tool/result'

describe('selection-context MCP tool mode', () => {
  test('exposes exactly the two selection context tools', () => {
    const descriptors = applyToolPolicy(createToolDescriptors(true), {
      allowEval: true,
      disabledTools: [],
      mode: 'selection-context'
    })

    expect(
      descriptors
        .filter((tool) => tool.enabled)
        .map((tool) => tool.name)
        .sort()
    ).toEqual([...SELECTION_CONTEXT_TOOLS].sort())
  })

  test('still honors disabled tools inside restricted mode', () => {
    const descriptors = applyToolPolicy(createToolDescriptors(false), {
      allowEval: false,
      disabledTools: ['get_user_selection_details'],
      mode: 'selection-context'
    })

    expect(descriptors.filter((tool) => tool.enabled).map((tool) => tool.name)).toEqual([
      'see_user_selection'
    ])
  })

  test('returns selection metadata and PNG as separate content blocks', () => {
    const result = imageToolResult('see_user_selection', {
      selectedCount: 1,
      selection: [{ id: 'node-1', name: 'Card', type: 'FRAME' }],
      mimeType: 'image/png',
      base64: 'AQID',
      byteLength: 3
    })

    expect(result?.content.map((content) => content.type)).toEqual(['text', 'image'])
    const text = result?.content[0]
    const image = result?.content[1]
    expect(text?.type === 'text' ? text.text : '').not.toContain('AQID')
    expect(image?.type === 'image' ? image.data : '').toBe('AQID')
  })

  test('validates configured tool modes', () => {
    expect(parseToolMode(undefined)).toBe('full')
    expect(parseToolMode('selection-context')).toBe('selection-context')
    expect(() => parseToolMode('unknown')).toThrow('OPENPENCIL_MCP_MODE')
  })
})
