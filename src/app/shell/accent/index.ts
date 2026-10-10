import { computed } from 'vue'

import { appPreferences, updateAccentPreference } from '@/app/settings/preferences/store'

import { accentBaseColor, deriveAccentPalette, type AccentTheme } from './palette'

export const accentPreference = computed({
  get: () => appPreferences.value.appearance.accent,
  set: updateAccentPreference
})

/** The accent family for the resolved interface theme. */
export function useAccentPalette(theme: () => AccentTheme) {
  return computed(() => deriveAccentPalette(accentBaseColor(accentPreference.value), theme()))
}
