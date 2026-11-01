import { computed } from 'vue'

import { appPreferences, updateInterfaceScale } from '@/app/settings/preferences/store'

/** Application chrome only: document coordinates and canvas zoom never use this preference. */
export const interfaceScalePreference = computed({
  get: () => appPreferences.value.appearance.interfaceScale,
  set: updateInterfaceScale
})

export function interfaceScaleFactor(): number {
  return interfaceScalePreference.value / 100
}
