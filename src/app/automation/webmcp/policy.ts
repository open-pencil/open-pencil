import * as v from 'valibot'

import { ALL_TOOLS, isAtomicTool, isToolExposed, type ToolDef } from '@open-pencil/core/tools'

import { webmcpModeSchema, type WebMCPMode } from './schema'

export function resolveWebMCPMode(value: unknown): WebMCPMode {
  const result = v.safeParse(webmcpModeSchema, value)
  return result.success ? result.output : 'off'
}

export function getWebMCPTools(mode: WebMCPMode, tools: readonly ToolDef[] = ALL_TOOLS) {
  return tools.filter(
    (tool) =>
      isToolExposed(tool, 'webmcp') &&
      (tool.execution.mutation === 'none' || isAtomicTool(tool)) &&
      mode !== 'off' &&
      (mode === 'edit' || !tool.mutates)
  )
}
