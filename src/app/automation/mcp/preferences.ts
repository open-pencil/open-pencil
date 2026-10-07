import { useLocalStorage } from '@vueuse/core'
import { ref } from 'vue'

import type { MCPToolScope, ToolDescriptor } from '@open-pencil/mcp/tools'

const DISABLED_TOOLS_STORAGE_KEY = 'open-pencil:mcp:disabled-tools'
const ROOT_DIRECTORY_STORAGE_KEY = 'open-pencil:mcp:root-directory'
const AUTHENTICATION_ENABLED_STORAGE_KEY = 'open-pencil:mcp:authentication-enabled'
const SELECTION_ONLY_STORAGE_KEY = 'open-pencil:mcp:selection-only'

export const configurableMCPTools = ref<ToolDescriptor[]>([])

export const disabledMCPTools = useLocalStorage<string[]>(DISABLED_TOOLS_STORAGE_KEY, [])
export const mcpRootDirectory = useLocalStorage(ROOT_DIRECTORY_STORAGE_KEY, '')
export const mcpAuthenticationEnabled = useLocalStorage(AUTHENTICATION_ENABLED_STORAGE_KEY, true)
/** Whether MCP clients may read only the selected layers; see `MCPToolScope`. */
export const mcpSelectionOnly = useLocalStorage(SELECTION_ONLY_STORAGE_KEY, false)

export function mcpScope(): MCPToolScope {
  return mcpSelectionOnly.value ? 'selection' : 'document'
}

export function setMCPToolDescriptors(tools: ToolDescriptor[]): void {
  configurableMCPTools.value = tools.filter((tool) => tool.availability !== 'eval')
}
