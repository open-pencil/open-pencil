import { computed, ref } from 'vue'

import { configurableAITools } from '@/app/ai/tools/catalog'
import { aiToolOverrides, disabledAITools } from '@/app/ai/tools/preferences'
import { configurableMCPTools, disabledMCPTools } from '@/app/automation/mcp/preferences'
import { openAutomationSettings } from '@/app/automation/settings/navigation'

import type { ToolAccessTarget } from '../types'

const target = ref<ToolAccessTarget>('ai')

export function openToolAccessSettings(value: ToolAccessTarget) {
  target.value = value
  openAutomationSettings('tools')
}

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
