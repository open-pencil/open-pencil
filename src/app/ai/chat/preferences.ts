import { computed } from 'vue'

import { appPreferences, type ReasoningDisplay } from '@/app/settings/preferences/store'

import { resolveAgentStepLimit } from './step-limit'

export const maxAgentSteps = computed({
  get: () => resolveAgentStepLimit(appPreferences.value.chat.maxAgentSteps),
  set: (value: number) => {
    appPreferences.value = {
      ...appPreferences.value,
      chat: { ...appPreferences.value.chat, maxAgentSteps: resolveAgentStepLimit(value) }
    }
  }
})

export const reasoningDisplay = computed({
  get: () => appPreferences.value.chat.reasoningDisplay,
  set: (reasoningDisplay: ReasoningDisplay) => {
    appPreferences.value = {
      ...appPreferences.value,
      chat: { ...appPreferences.value.chat, reasoningDisplay }
    }
  }
})
