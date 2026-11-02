import { afterEach, expect, test } from 'bun:test'

import { ALL_TOOLS, CORE_TOOLS, isToolExposed } from '@open-pencil/core/tools'

import { configurableAITools, enabledAIToolDefinitions } from '@/app/ai/tools/catalog'
import { aiToolOverrides, disabledAITools } from '@/app/ai/tools/preferences'
import { configurableMCPTools, disabledMCPTools } from '@/app/automation/mcp/preferences'
import { useToolAccessSettings } from '@/app/automation/tool-access/settings/use'

const originalAI = aiToolOverrides.value
const originalMCP = disabledMCPTools.value
const originalCatalog = configurableMCPTools.value

afterEach(() => {
  aiToolOverrides.value = originalAI
  disabledMCPTools.value = originalMCP
  configurableMCPTools.value = originalCatalog
})

test('AI catalog includes exposed extended tools while preserving compact defaults', () => {
  expect(configurableAITools.map((tool) => tool.name)).toEqual(
    ALL_TOOLS.filter((tool) => isToolExposed(tool, 'ai')).map((tool) => tool.name)
  )
  const defaults = enabledAIToolDefinitions({}).map((tool) => tool.name)
  for (const tool of CORE_TOOLS) {
    if (isToolExposed(tool, 'ai')) expect(defaults).toContain(tool.name)
  }
  expect(defaults).toContain('get_components')
  expect(defaults).toContain('list_libraries')
  expect(defaults).toContain('insert_library_component')
  for (const name of [
    'get_comments',
    'add_comment',
    'reply_to_comment',
    'resolve_comment',
    'list_variables',
    'create_collection',
    'create_variable',
    'set_variable',
    'bind_variable',
    'lint',
    'lint_fix',
    'export_image',
    'list_pages',
    'create_page'
  ]) {
    expect(defaults).toContain(name)
  }
  // Moving the view stays the user's choice.
  expect(defaults).not.toContain('switch_page')
  expect(defaults).not.toContain('create_component')
  expect(enabledAIToolDefinitions({ create_component: true }).map((tool) => tool.name)).toContain(
    'create_component'
  )
  expect(
    enabledAIToolDefinitions({ get_components: false }).map((tool) => tool.name)
  ).not.toContain('get_components')
  expect(enabledAIToolDefinitions({ unknown_tool: true }).map((tool) => tool.name)).not.toContain(
    'unknown_tool'
  )
})

test('each kind of agent keeps its own permissions through bulk changes and reset', () => {
  aiToolOverrides.value = {}
  disabledMCPTools.value = ['create_component']
  const ai = useToolAccessSettings('ai')
  const mcp = useToolAccessSettings('mcp')
  expect(ai.disabled.value).toContain('create_component')
  ai.disabled.value = ai.disabled.value.filter((name) => name !== 'create_component')
  expect(disabledAITools.value).not.toContain('create_component')
  expect(disabledMCPTools.value).toEqual(['create_component'])
  mcp.reset()
  expect(disabledMCPTools.value).toEqual([])
  expect(disabledAITools.value).not.toContain('create_component')
  mcp.disabled.value = ['find_nodes']
  ai.reset()
  expect(aiToolOverrides.value).toEqual({})
  expect(disabledAITools.value).toContain('create_component')
  expect(disabledMCPTools.value).toEqual(['find_nodes'])
})

test('disabling all AI tools is preserved and does not change MCP access', () => {
  const access = useToolAccessSettings('ai')
  access.disabled.value = configurableAITools.map((tool) => tool.name)
  expect(enabledAIToolDefinitions(aiToolOverrides.value)).toEqual([])
})
