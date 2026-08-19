import { useLocalStorage } from '@vueuse/core'

import { MCP_TOOL_CATALOG } from '@open-pencil/mcp/tools'

const DISABLED_TOOLS_STORAGE_KEY = 'open-pencil:mcp:disabled-tools'

export const configurableMCPTools = MCP_TOOL_CATALOG.filter((tool) => tool.requirement !== 'eval')

export const disabledMCPTools = useLocalStorage<string[]>(DISABLED_TOOLS_STORAGE_KEY, [])

export function setMCPToolEnabled(name: string, enabled: boolean): void {
  const disabled = new Set(disabledMCPTools.value)
  if (enabled) disabled.delete(name)
  else disabled.add(name)
  disabledMCPTools.value = [...disabled]
}

export function disabledMCPToolsCSV(): string {
  return disabledMCPTools.value.join(',')
}
