import type { ToolDescriptor, ToolPolicy } from '#mcp/tool/metadata'

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

export function readToolPolicyFromEnv(env: NodeJS.ProcessEnv = process.env): ToolPolicy {
  return {
    allowEval: env.OPENPENCIL_MCP_EVAL === '1',
    disabledTools: parseDisabledTools(env.OPENPENCIL_MCP_DISABLED_TOOLS)
  }
}
