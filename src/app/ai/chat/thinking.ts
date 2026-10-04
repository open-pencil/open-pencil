import { computed, shallowRef } from 'vue'

import { designModelProfile } from '@/app/ai/models'
import type { AIModelProfileId, ThinkingLevel } from '@/app/ai/models/types'

/** The composer's choice applies to the Design profile it was made for; switching profiles drops it. */
const composerChoice = shallowRef<{
  profileId: AIModelProfileId | null
  level: ThinkingLevel
} | null>(null)

/** The level the next direct-model message uses. */
export const chatThinkingLevel = computed<ThinkingLevel>({
  get: () => {
    const profile = designModelProfile.value
    const choice = composerChoice.value
    if (choice?.profileId === (profile?.id ?? null)) return choice.level
    return profile?.thinkingLevel ?? 'default'
  },
  set: (level) => {
    composerChoice.value = { profileId: designModelProfile.value?.id ?? null, level }
  }
})
