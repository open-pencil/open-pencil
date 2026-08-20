import { useLocalStorage } from '@vueuse/core'

import { MCP_TOOL_CATALOG, type MCPToolCatalogEntry } from '@open-pencil/mcp/tools'

const DISABLED_TOOLS_STORAGE_KEY = 'open-pencil:mcp:disabled-tools'
const ROOT_DIRECTORY_STORAGE_KEY = 'open-pencil:mcp:root-directory'

export const configurableMCPTools = MCP_TOOL_CATALOG.filter((tool) => tool.availability !== 'eval')

export const disabledMCPTools = useLocalStorage<string[]>(DISABLED_TOOLS_STORAGE_KEY, [])
export const mcpRootDirectory = useLocalStorage(ROOT_DIRECTORY_STORAGE_KEY, '')

export function setMCPToolEnabled(name: string, enabled: boolean): void {
  const disabled = new Set(disabledMCPTools.value)
  if (enabled) disabled.delete(name)
  else disabled.add(name)
  disabledMCPTools.value = [...disabled]
}

export function setMCPToolCategoryEnabled(
  documentAccess: MCPToolCatalogEntry['documentAccess'],
  enabled: boolean
): void {
  const disabled = new Set(disabledMCPTools.value)
  for (const tool of configurableMCPTools) {
    if (tool.documentAccess !== documentAccess) continue
    if (enabled) disabled.delete(tool.name)
    else disabled.add(tool.name)
  }
  disabledMCPTools.value = [...disabled]
}

export function disabledMCPToolsCSV(): string {
  return disabledMCPTools.value.join(',')
}
