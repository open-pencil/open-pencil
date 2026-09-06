import { computed, onMounted, ref } from 'vue'

import type { ToolEffect } from '@open-pencil/mcp/tools'

import {
  configurableMCPTools,
  disabledMCPTools,
  mcpRootDirectory
} from '@/app/automation/mcp/preferences'
import { refreshMCPRuntime, restartMCPRuntime } from '@/app/automation/mcp/runtime'
import { isTauri } from '@/app/tauri/env'

export function useMCPSettings() {
  const toolSearch = ref('')

  const disabledToolNames = computed(() => new Set(disabledMCPTools.value))

  function categoryStatus(effect: ToolEffect) {
    const tools = configurableMCPTools.value.filter((tool) => tool.effect === effect)
    const enabled = tools.filter((tool) => !disabledToolNames.value.has(tool.name)).length

    return {
      enabled: enabled > 0,
      state: enabled > 0 && enabled < tools.length ? ('mixed' as const) : ('idle' as const)
    }
  }

  const inspectionToolsStatus = computed(() => categoryStatus('read'))
  const modificationToolsStatus = computed(() => categoryStatus('write'))
  const enabledToolCount = computed(
    () =>
      configurableMCPTools.value.filter((tool) => !disabledToolNames.value.has(tool.name)).length
  )
  const visibleTools = computed(() => {
    const query = toolSearch.value.trim().toLowerCase()
    if (!query) return configurableMCPTools.value
    return configurableMCPTools.value.filter(
      (tool) =>
        tool.name.toLowerCase().includes(query) || tool.description.toLowerCase().includes(query)
    )
  })

  onMounted(() => {
    void refreshMCPRuntime()
  })

  function restart(): void {
    void restartMCPRuntime()
  }

  async function chooseRootDirectory(): Promise<void> {
    if (!isTauri()) return

    const { open } = await import('@tauri-apps/plugin-dialog')
    const directory = await open({ directory: true, multiple: false })
    if (typeof directory === 'string') mcpRootDirectory.value = directory
  }

  function isToolEnabled(name: string): boolean {
    return !disabledToolNames.value.has(name)
  }

  function enableAllTools(): void {
    disabledMCPTools.value = []
  }

  return {
    toolSearch,
    inspectionToolsStatus,
    modificationToolsStatus,
    enabledToolCount,
    visibleTools,
    restart,
    chooseRootDirectory,
    isToolEnabled,
    enableAllTools
  }
}
