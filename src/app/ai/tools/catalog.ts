import { ALL_TOOLS, CORE_TOOLS, isToolExposed, toolChangesDocument } from '@open-pencil/core/tools'

import type { ToolAccessEntry } from '@/app/automation/tool-access/types'

/** Preserve the compact shipped tool set as defaults, not as an availability restriction. */
const defaultNames = new Set([
  ...CORE_TOOLS.map((tool) => tool.name),
  'get_components',
  'list_libraries',
  'insert_library_component',
  // Scripts cannot discover comments, so without these the model fakes them with layers.
  'get_comments',
  'add_comment',
  'reply_to_comment',
  'resolve_comment',
  // Design JSX references variables but cannot create them, and `eval` names differ from Figma's.
  'list_variables',
  'create_collection',
  'create_variable',
  'set_variable',
  'bind_variable',
  // Switches a layer that already exists to a theme; design JSX sets one only on new layers.
  'set_variable_mode',
  'get_variable_modes',
  'lint',
  'lint_fix',
  // Lets the model look at what it built.
  'export_image',
  'list_pages',
  'create_page'
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
