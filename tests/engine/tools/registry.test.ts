import { describe, expect, test } from 'bun:test'

// eslint-disable-next-line lawha/no-mixed-case-acronym-identifiers -- Upstream export spelling.
import { toJsonSchema as toJSONSchema } from '@valibot/to-json-schema'

import { isAtomicTool, isToolExposed } from '@lawha/core/tools'

import { ALL_TOOLS } from '#tests/helpers/tools'

describe('tool definitions', () => {
  test('exposure defaults to inclusion and exclusions affect only the named interface', () => {
    for (const target of ['mcp', 'ai', 'webmcp'] as const) {
      expect(isToolExposed({ exposure: {} }, target)).toBe(true)
      expect(isToolExposed({ exposure: { [target]: true } }, target)).toBe(true)
      expect(isToolExposed({ exposure: { [target]: false } }, target)).toBe(false)
    }
    expect(isToolExposed({ exposure: { webmcp: false, ai: false } }, 'mcp')).toBe(true)
  })

  test('all tools have unique names and native input schemas', () => {
    const names = ALL_TOOLS.map((tool) => tool.name)
    expect(new Set(names).size).toBe(names.length)
    for (const tool of ALL_TOOLS) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(typeof tool.execute).toBe('function')
      expect(toJSONSchema(tool.input, { typeMode: 'input' }).type).toBe('object')
    }
  })

  test('browser-eligible tools declare document capabilities', () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.mutates).toBe(tool.execution.mutation !== 'none')
      if (!isToolExposed(tool, 'webmcp')) continue
      if (tool.execution.mutation !== 'none' && !isAtomicTool(tool)) continue
      expect(
        tool.capabilities.every(
          (capability) => capability === 'document:read' || capability === 'document:write'
        )
      ).toBe(true)
    }
  })
})
