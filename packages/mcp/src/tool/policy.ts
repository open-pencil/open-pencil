import type { MCPToolMode, ToolDescriptor, ToolPolicy } from '#mcp/tool/metadata'

export const SELECTION_CONTEXT_TOOLS = ['see_user_selection', 'get_user_selection_details'] as const

const SELECTION_CONTEXT_TOOL_SET: ReadonlySet<string> = new Set(SELECTION_CONTEXT_TOOLS)

export function parseDisabledTools(value: string | undefined): string[] {
  if (!value) return []
  return [
    ...new Set(
      value
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean)
    )
  ]
}

export function isToolEnabled(descriptor: ToolDescriptor, policy: ToolPolicy): boolean {
  if (policy.mode === 'selection-context' && !SELECTION_CONTEXT_TOOL_SET.has(descriptor.name)) {
    return false
  }
  if (policy.disabledTools.includes(descriptor.name)) return false
  return descriptor.availability !== 'eval' || policy.allowEval
}

export function applyToolPolicy(
  descriptors: readonly ToolDescriptor[],
  policy: ToolPolicy
): ToolDescriptor[] {
  return descriptors.map((descriptor) => ({
    ...descriptor,
    enabled: isToolEnabled(descriptor, policy)
  }))
}

export function serializeDisabledTools(names: readonly string[]): string {
  return names.join(',')
}

export function parseToolMode(value: string | undefined): MCPToolMode {
  if (!value || value === 'full') return 'full'
  if (value === 'selection-context') return value
  throw new Error('OPENPENCIL_MCP_MODE must be either "full" or "selection-context"')
}

export function readToolPolicyFromEnv(env: NodeJS.ProcessEnv = process.env): ToolPolicy {
  return {
    allowEval: env.OPENPENCIL_MCP_EVAL === '1',
    disabledTools: parseDisabledTools(env.OPENPENCIL_MCP_DISABLED_TOOLS),
    mode: parseToolMode(env.OPENPENCIL_MCP_MODE)
  }
}
