import { computed } from 'vue'

import { useDesignCheckMessages } from '@open-pencil/vue'

import type { DesignCheckPreset } from '@/app/settings/preferences/store'

/** Localized names of the rule presets, shared by the rules menu and empty states. */
export function usePresetLabels() {
  const messages = useDesignCheckMessages()
  return computed<Record<DesignCheckPreset, string>>(() => ({
    recommended: messages.value.presetRecommended,
    strict: messages.value.presetStrict,
    accessibility: messages.value.presetAccessibility
  }))
}
