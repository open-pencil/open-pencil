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
    :independent-corners="ctx.independentCorners.value"
    :show-independent-corners="ctx.showIndependentCorners.value"
    :corner-radius-value="ctx.cornerRadiusValue.value"
    :opacity-percent="ctx.opacityPercent.value"
    :blend-mode-value="ctx.blendModeValue.value"
    :visibility-state="ctx.visibilityState.value"
    :actions="actions"
  />
</template>
