import { computed, ref } from 'vue'

import { configurableAITools } from '@/app/ai/tools/catalog'
import { aiToolOverrides, disabledAITools } from '@/app/ai/tools/preferences'
import { configurableMCPTools, disabledMCPTools } from '@/app/automation/mcp/preferences'
import { openSettingsDialog } from '@/app/settings/dialog'

import type { ToolAccessEntry, ToolAccessTarget } from '../types'

/** Whether the MCP page shows its tool list, which it opens over itself. */
export const mcpToolAccessOpen = ref(false)

/**
 * Opens the tools of one kind of agent where they are set: the built-in AI's on Tool access, the
 * local MCP server's on the MCP page.
 */
export function openToolAccessSettings(target: ToolAccessTarget) {
  mcpToolAccessOpen.value = target === 'mcp'
  openSettingsDialog(target === 'ai' ? 'tools' : 'mcp')
}

function countOn(tools: ToolAccessEntry[], disabled: string[]) {
  const off = new Set(disabled)
  return { enabled: tools.filter((tool) => !off.has(tool.name)).length, total: tools.length }
}

/** How many tools each kind of agent can call, for the MCP page's link to its list. */
export const toolAccessCounts = computed<
  Record<ToolAccessTarget, { enabled: number; total: number }>
>(() => ({
  ai: countOn(configurableAITools, disabledAITools.value),
  mcp: countOn(configurableMCPTools.value, disabledMCPTools.value)
}))

/** The tools one kind of agent can call, and its own disabled list. */
export function useToolAccessSettings(target: ToolAccessTarget) {
  const tools = computed(() => (target === 'ai' ? configurableAITools : configurableMCPTools.value))
  const disabled = computed({
    get: () => (target === 'ai' ? disabledAITools.value : disabledMCPTools.value),
    set: (names: string[]) => {
      if (target === 'ai') disabledAITools.value = names
      else disabledMCPTools.value = names
    }
  })

  function reset() {
    if (target === 'ai') aiToolOverrides.value = {}
    else disabledMCPTools.value = []
  }

  return { tools, disabled, reset }
}
