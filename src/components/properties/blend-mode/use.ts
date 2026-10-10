import { computed } from 'vue'

import type { BlendMode } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'

import type { AppSelectGroup } from '@/components/ui/select/select'

export function commitDiscretePropertyListChange(flush: () => void, update: () => void): void {
  update()
  flush()
}

/** Blend modes by what they do: darken, lighten, contrast, compare, and the component modes. */
export function useBlendModeGroups(includePassThrough = false) {
  const { panels } = useI18n()
  return computed<AppSelectGroup<BlendMode>[]>(() => [
    {
      options: [
        ...(includePassThrough
          ? [{ value: 'PASS_THROUGH' as const, label: panels.value.blendModePassThrough }]
          : []),
        { value: 'NORMAL', label: panels.value.blendModeNormal }
      ]
    },
    {
      options: [
        { value: 'DARKEN', label: panels.value.blendModeDarken },
        { value: 'MULTIPLY', label: panels.value.blendModeMultiply },
        { value: 'COLOR_BURN', label: panels.value.blendModeColorBurn }
      ]
    },
    {
      options: [
        { value: 'LIGHTEN', label: panels.value.blendModeLighten },
        { value: 'SCREEN', label: panels.value.blendModeScreen },
        { value: 'COLOR_DODGE', label: panels.value.blendModeColorDodge }
      ]
    },
    {
      options: [
        { value: 'OVERLAY', label: panels.value.blendModeOverlay },
        { value: 'SOFT_LIGHT', label: panels.value.blendModeSoftLight },
        { value: 'HARD_LIGHT', label: panels.value.blendModeHardLight }
      ]
    },
    {
      options: [
        { value: 'DIFFERENCE', label: panels.value.blendModeDifference },
        { value: 'EXCLUSION', label: panels.value.blendModeExclusion }
      ]
    },
    {
      options: [
        { value: 'HUE', label: panels.value.blendModeHue },
        { value: 'SATURATION', label: panels.value.blendModeSaturation },
        { value: 'COLOR', label: panels.value.blendModeColor },
        { value: 'LUMINOSITY', label: panels.value.blendModeLuminosity }
      ]
    }
  ])
}
