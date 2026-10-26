import { computed, ref } from 'vue'

import { configurableAITools } from '@/app/ai/tools/catalog'
import { aiToolOverrides, disabledAITools } from '@/app/ai/tools/preferences'
import { configurableMCPTools, disabledMCPTools } from '@/app/automation/mcp/preferences'
import { openSettingsDialog } from '@/app/settings/dialog'

import type { ToolAccessEntry, ToolAccessTarget } from '../types'

const target = ref<ToolAccessTarget>('ai')

export function openToolAccessSettings(value: ToolAccessTarget) {
  target.value = value
  openSettingsDialog('tools')
}

function countOn(tools: ToolAccessEntry[], disabled: string[]) {
  const off = new Set(disabled)
  return { enabled: tools.filter((tool) => !off.has(tool.name)).length, total: tools.length }
}

/** How many tools each kind of agent can call, for the tabs and the MCP page. */
export const toolAccessCounts = computed<
  Record<ToolAccessTarget, { enabled: number; total: number }>
>(() => ({
  ai: countOn(configurableAITools, disabledAITools.value),
  mcp: countOn(configurableMCPTools.value, disabledMCPTools.value)
}))

export function useToolAccessSettings() {
  const tools = computed(() =>
    target.value === 'ai' ? configurableAITools : configurableMCPTools.value
  )
  const disabled = computed({
    get: () => (target.value === 'ai' ? disabledAITools.value : disabledMCPTools.value),
    set: (names: string[]) => {
      if (target.value === 'ai') disabledAITools.value = names
      else disabledMCPTools.value = names
    }
  })

  function selectTarget(value: string) {
    if (value === 'ai' || value === 'mcp') target.value = value
  }

  function reset() {
    if (target.value === 'ai') aiToolOverrides.value = {}
    else disabledMCPTools.value = []
  }

  return { target, tools, disabled, selectTarget, reset }
}
