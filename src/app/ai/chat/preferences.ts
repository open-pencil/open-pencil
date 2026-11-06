import { computed } from 'vue'

import { resolveAgentStepLimit } from '@/app/ai/reply/step-limit'
import {
  appPreferences,
  type ChangePreviewSize,
  type ReasoningDisplay,
  type TokenUsageDisplay
} from '@/app/settings/preferences/store'

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

export const changePreviewSize = computed({
  get: () => appPreferences.value.chat.changePreviewSize,
  set: (changePreviewSize: ChangePreviewSize) => {
    appPreferences.value = {
      ...appPreferences.value,
      chat: { ...appPreferences.value.chat, changePreviewSize }
    }
  }
})

export const compactAutomatically = computed({
  get: () => appPreferences.value.chat.compactAutomatically,
  set: (compactAutomatically: boolean) => {
    appPreferences.value = {
      ...appPreferences.value,
      chat: { ...appPreferences.value.chat, compactAutomatically }
    }
  }
})

export const tokenUsageDisplay = computed({
  get: () => appPreferences.value.chat.tokenUsage,
  set: (tokenUsage: TokenUsageDisplay) => {
    appPreferences.value = {
      ...appPreferences.value,
      chat: { ...appPreferences.value.chat, tokenUsage }
    }
  }
})
