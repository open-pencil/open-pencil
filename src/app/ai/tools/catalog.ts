import { ALL_TOOLS, CORE_TOOLS, isToolExposed, toolChangesDocument } from '@open-pencil/core/tools'

import type { ToolAccessEntry } from '@/app/automation/tool-access/types'

/** Preserve the compact shipped tool set as defaults, not as an availability restriction. */
const defaultNames = new Set([
  ...CORE_TOOLS.map((tool) => tool.name),
  'get_components',
  'list_libraries',
  'insert_library_component'
])

export const aiToolDefinitions = ALL_TOOLS.filter((tool) => isToolExposed(tool, 'ai'))

export const configurableAITools: ToolAccessEntry[] = aiToolDefinitions.map((tool) => ({
  name: tool.name,
  description: tool.description,
  effect: toolChangesDocument(tool) ? 'write' : 'read'
}))

export function isAIToolEnabled(name: string, overrides: Readonly<Record<string, boolean>>) {
  return overrides[name] ?? defaultNames.has(name)
}

export function enabledAIToolDefinitions(overrides: Readonly<Record<string, boolean>>) {
  return aiToolDefinitions.filter((tool) => isAIToolEnabled(tool.name, overrides))
}
