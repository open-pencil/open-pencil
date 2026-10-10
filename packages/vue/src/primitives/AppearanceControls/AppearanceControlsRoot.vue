<script setup lang="ts">
import { useAppearance } from '#vue/controls/appearance/use'
import type { AppearanceControlsRootSlots } from '#vue/primitives/AppearanceControls/types'

const ctx = useAppearance()
defineSlots<AppearanceControlsRootSlots>()
const actions = {
  updateProp: ctx.updateProp,
  commitProp: ctx.commitProp,
  setBlendMode: ctx.setBlendMode,
  toggleVisibility: ctx.toggleVisibility,
  toggleIndependentCorners: ctx.toggleIndependentCorners,
  updateUniformRadius: ctx.updateUniformRadius,
  commitUniformRadius: ctx.commitUniformRadius,
  updateCornerProp: ctx.updateCornerProp,
  commitCornerProp: ctx.commitCornerProp
}
</script>

<template>
  <slot
    :node="ctx.node.value"
    :is-multi="ctx.isMulti.value"
    :active="ctx.active.value"
    :has-corner-radius="ctx.hasCornerRadius.value"
    :corner-radius-disabled="ctx.cornerRadiusDisabled.value"
    :independent-corners="ctx.independentCorners.value"
    :show-independent-corners="ctx.showIndependentCorners.value"
    :corner-radius-value="ctx.cornerRadiusValue.value"
    :corner-radius-binding-paths="ctx.cornerRadiusBindingPaths.value"
    :corner-smoothing-percent="ctx.cornerSmoothingPercent.value"
    :opacity-percent="ctx.opacityPercent.value"
    :blend-mode-value="ctx.blendModeValue.value"
    :visibility-state="ctx.visibilityState.value"
    :actions="actions"
  />
</template>
