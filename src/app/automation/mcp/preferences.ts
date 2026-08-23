import { useLocalStorage } from '@vueuse/core'
import { ref } from 'vue'

import type { ToolDescriptor, ToolEffect } from '@open-pencil/mcp/tools'

const DISABLED_TOOLS_STORAGE_KEY = 'open-pencil:mcp:disabled-tools'
const ROOT_DIRECTORY_STORAGE_KEY = 'open-pencil:mcp:root-directory'
const AUTHENTICATION_ENABLED_STORAGE_KEY = 'open-pencil:mcp:authentication-enabled'

export const configurableMCPTools = ref<ToolDescriptor[]>([])

export const disabledMCPTools = useLocalStorage<string[]>(DISABLED_TOOLS_STORAGE_KEY, [])
export const mcpRootDirectory = useLocalStorage(ROOT_DIRECTORY_STORAGE_KEY, '')
export const mcpAuthenticationEnabled = useLocalStorage(AUTHENTICATION_ENABLED_STORAGE_KEY, true)

export function setMCPToolDescriptors(tools: ToolDescriptor[]): void {
  configurableMCPTools.value = tools.filter((tool) => tool.availability !== 'eval')
}

export function setMCPToolEnabled(name: string, enabled: boolean): void {
  const disabled = new Set(disabledMCPTools.value)
  if (enabled) disabled.delete(name)
  else disabled.add(name)
  disabledMCPTools.value = [...disabled]
}

export function setMCPToolCategoryEnabled(effect: ToolEffect, enabled: boolean): void {
  const disabled = new Set(disabledMCPTools.value)
  for (const tool of configurableMCPTools.value) {
    if (tool.effect !== effect) continue
    if (enabled) disabled.delete(tool.name)
    else disabled.add(tool.name)
  }
  disabledMCPTools.value = [...disabled]
}
