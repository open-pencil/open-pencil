import { usePreferredReducedMotion } from '@vueuse/core'
import { computed } from 'vue'

import { appPreferences, updateAnimationPreference } from '@/app/settings/preferences/store'

const preferredMotion = usePreferredReducedMotion()
export const animationPreference = computed({
  get: () => appPreferences.value.appearance.animations,
  set: updateAnimationPreference
})
export const animationsEnabled = computed(
  () => animationPreference.value === 'system' && preferredMotion.value !== 'reduce'
)
