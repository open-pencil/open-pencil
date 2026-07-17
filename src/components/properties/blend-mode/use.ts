import { computed } from 'vue'

import type { BlendMode } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'

export function commitDiscretePropertyListChange(flush: () => void, update: () => void): void {
  update()
  flush()
}

export interface BlendModeOption {
  value: BlendMode
  label: string
}

export function useBlendModeOptions(includePassThrough = false) {
  const { panels } = useI18n()
  return computed<BlendModeOption[]>(() => [
    ...(includePassThrough
      ? [{ value: 'PASS_THROUGH' as const, label: panels.value.blendModePassThrough }]
      : []),
    { value: 'NORMAL', label: panels.value.blendModeNormal },
    { value: 'DARKEN', label: panels.value.blendModeDarken },
    { value: 'MULTIPLY', label: panels.value.blendModeMultiply },
    { value: 'COLOR_BURN', label: panels.value.blendModeColorBurn },
    { value: 'LIGHTEN', label: panels.value.blendModeLighten },
    { value: 'SCREEN', label: panels.value.blendModeScreen },
    { value: 'COLOR_DODGE', label: panels.value.blendModeColorDodge },
    { value: 'OVERLAY', label: panels.value.blendModeOverlay },
    { value: 'SOFT_LIGHT', label: panels.value.blendModeSoftLight },
    { value: 'HARD_LIGHT', label: panels.value.blendModeHardLight },
    { value: 'DIFFERENCE', label: panels.value.blendModeDifference },
    { value: 'EXCLUSION', label: panels.value.blendModeExclusion },
    { value: 'HUE', label: panels.value.blendModeHue },
    { value: 'SATURATION', label: panels.value.blendModeSaturation },
    { value: 'COLOR', label: panels.value.blendModeColor },
    { value: 'LUMINOSITY', label: panels.value.blendModeLuminosity }
  ])
}
