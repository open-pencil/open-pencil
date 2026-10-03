import { useLocalStorage } from '@vueuse/core'
import { ref } from 'vue'

import type { MCPToolMode, ToolDescriptor } from '@open-pencil/mcp/tools'

const DISABLED_TOOLS_STORAGE_KEY = 'open-pencil:mcp:disabled-tools'
const ROOT_DIRECTORY_STORAGE_KEY = 'open-pencil:mcp:root-directory'
const AUTHENTICATION_ENABLED_STORAGE_KEY = 'open-pencil:mcp:authentication-enabled'
const TOOL_MODE_STORAGE_KEY = 'open-pencil:mcp:tool-mode'

export const configurableMCPTools = ref<ToolDescriptor[]>([])

export const disabledMCPTools = useLocalStorage<string[]>(DISABLED_TOOLS_STORAGE_KEY, [])
export const mcpRootDirectory = useLocalStorage(ROOT_DIRECTORY_STORAGE_KEY, '')
export const mcpAuthenticationEnabled = useLocalStorage(AUTHENTICATION_ENABLED_STORAGE_KEY, true)
export const mcpToolMode = useLocalStorage<MCPToolMode>(TOOL_MODE_STORAGE_KEY, 'full')

export function setMCPToolDescriptors(tools: ToolDescriptor[]): void {
  configurableMCPTools.value = tools.filter((tool) => tool.availability !== 'eval')
}
