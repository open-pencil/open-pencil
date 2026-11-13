import { afterEach, expect, test } from 'bun:test'

import { ref } from 'vue'

import { ALL_TOOLS, CORE_TOOLS, isToolExposed } from '@open-pencil/core/tools'

import { configurableAITools, enabledAIToolDefinitions } from '@/app/ai/tools/catalog'
import { aiToolOverrides, disabledAITools } from '@/app/ai/tools/preferences'
import { configurableMCPTools, disabledMCPTools } from '@/app/automation/mcp/preferences'
import { useToolAccess } from '@/app/automation/tool-access/settings/list'
import { useToolAccessSettings } from '@/app/automation/tool-access/settings/use'
import type { ToolAccessEntry } from '@/app/automation/tool-access/types'
import { recordToolUse, toolUsage } from '@/app/automation/tool-access/usage'

const originalUsage = toolUsage.value
const originalAI = aiToolOverrides.value
const originalMCP = disabledMCPTools.value
const originalCatalog = configurableMCPTools.value

afterEach(() => {
  toolUsage.value = originalUsage
  aiToolOverrides.value = originalAI
  disabledMCPTools.value = originalMCP
  configurableMCPTools.value = originalCatalog
})

test('sorting updates as calls arrive while preserving the MCP catalog order', () => {
  toolUsage.value = { startedAt: null, counts: {} }
  const tools = ref<ToolAccessEntry[]>([
    { name: 'zeta', description: 'Z', effect: 'read' },
    { name: 'alpha', description: 'A', effect: 'read' },
    { name: 'beta', description: 'B', effect: 'read' }
  ])
  const access = useToolAccess(tools, ref<string[]>([]))
  const mcp = useToolAccess(tools, ref<string[]>([]), ref('default'))
  const names = () => access.visibleTools.value.map((item) => item.name)
  expect(names()).toEqual(['alpha', 'beta', 'zeta'])
  expect(mcp.visibleTools.value.map((item) => item.name)).toEqual(['zeta', 'alpha', 'beta'])

  access.sort.value = 'most-used'
  recordToolUse('zeta')
  expect(names()).toEqual(['zeta', 'alpha', 'beta'])
  recordToolUse('beta')
  recordToolUse('beta')
  expect(names()).toEqual(['beta', 'zeta', 'alpha'])
  access.sort.value = 'least-used'
  expect(names()).toEqual(['alpha', 'zeta', 'beta'])
  access.search.value = 'z'
  expect(names()).toEqual(['zeta'])
})

test('AI catalog includes exposed extended tools while preserving compact defaults', () => {
  expect(configurableAITools.map((tool) => tool.name)).toEqual(
    ALL_TOOLS.filter((tool) => isToolExposed(tool, 'ai')).map((tool) => tool.name)
  )
  const defaults = enabledAIToolDefinitions({}).map((tool) => tool.name)
  for (const tool of CORE_TOOLS) {
    if (isToolExposed(tool, 'ai')) expect(defaults).toContain(tool.name)
  }
  expect(defaults).toContain('list_components')
  expect(defaults).toContain('list_libraries')
  expect(defaults).toContain('insert_library_component')
  for (const name of [
    'list_comments',
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
  expect(defaults).not.toContain('convert_to_components')
  expect(
    enabledAIToolDefinitions({ convert_to_components: true }).map((tool) => tool.name)
  ).toContain('convert_to_components')
  expect(
    enabledAIToolDefinitions({ list_components: false }).map((tool) => tool.name)
  ).not.toContain('list_components')
  expect(enabledAIToolDefinitions({ unknown_tool: true }).map((tool) => tool.name)).not.toContain(
    'unknown_tool'
  )
})

test('each kind of agent keeps its own permissions through bulk changes and reset', () => {
  aiToolOverrides.value = {}
  disabledMCPTools.value = ['convert_to_components']
  const ai = useToolAccessSettings('ai')
  const mcp = useToolAccessSettings('mcp')
  expect(ai.disabled.value).toContain('convert_to_components')
  ai.disabled.value = ai.disabled.value.filter((name) => name !== 'convert_to_components')
  expect(disabledAITools.value).not.toContain('convert_to_components')
  expect(disabledMCPTools.value).toEqual(['convert_to_components'])
  mcp.reset()
  expect(disabledMCPTools.value).toEqual([])
  expect(disabledAITools.value).not.toContain('convert_to_components')
  mcp.disabled.value = ['find_nodes']
  ai.reset()
  expect(aiToolOverrides.value).toEqual({})
  expect(disabledAITools.value).toContain('convert_to_components')
  expect(disabledMCPTools.value).toEqual(['find_nodes'])
})

test('disabling all AI tools is preserved and does not change MCP access', () => {
  const access = useToolAccessSettings('ai')
  access.disabled.value = configurableAITools.map((tool) => tool.name)
  expect(enabledAIToolDefinitions(aiToolOverrides.value)).toEqual([])
})
