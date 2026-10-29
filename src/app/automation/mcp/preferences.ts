import { useLocalStorage } from '@vueuse/core'
import { ref } from 'vue'

import { type MCPToolScope, type ToolDescriptor } from '@open-pencil/mcp/tools'
import { createToolDescriptors } from '@open-pencil/mcp/tools'

const DISABLED_TOOLS_STORAGE_KEY = 'open-pencil:mcp:disabled-tools'
const ROOT_DIRECTORY_STORAGE_KEY = 'open-pencil:mcp:root-directory'
const AUTHENTICATION_ENABLED_STORAGE_KEY = 'open-pencil:mcp:authentication-enabled'
const SELECTION_ONLY_STORAGE_KEY = 'open-pencil:mcp:selection-only'

function configurable(tools: ToolDescriptor[]): ToolDescriptor[] {
  return tools.filter((tool) => tool.availability !== 'eval')
}

const CORE_MCP_TOOLS = configurable(createToolDescriptors(true))

/**
 * The tools the local server offers. Known from Core, so Settings can configure them while no
 * server runs; a running server's own list replaces them.
 */
export const configurableMCPTools = ref<ToolDescriptor[]>(CORE_MCP_TOOLS)

export const disabledMCPTools = useLocalStorage<string[]>(DISABLED_TOOLS_STORAGE_KEY, [])
export const mcpRootDirectory = useLocalStorage(ROOT_DIRECTORY_STORAGE_KEY, '')
export const mcpAuthenticationEnabled = useLocalStorage(AUTHENTICATION_ENABLED_STORAGE_KEY, true)
/** Whether MCP clients may read only the selected layers; see `MCPToolScope`. */
export const mcpSelectionOnly = useLocalStorage(SELECTION_ONLY_STORAGE_KEY, false)

export function mcpScope(): MCPToolScope {
  return mcpSelectionOnly.value ? 'selection' : 'document'
}

export function setMCPToolDescriptors(tools: ToolDescriptor[]): void {
  // A stopped server, or one that hides its tools behind authentication, reports none.
  configurableMCPTools.value = tools.length > 0 ? configurable(tools) : CORE_MCP_TOOLS
}
