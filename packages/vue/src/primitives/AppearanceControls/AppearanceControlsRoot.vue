<script setup lang="ts">
import { useAppearance } from '#vue/controls/appearance/use'

const ctx = useAppearance()
const actions = {
  updateProp: ctx.updateProp,
  commitProp: ctx.commitProp,
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
    :corner-radius-value="ctx.cornerRadiusValue.value"
    :opacity-percent="ctx.opacityPercent.value"
    :visibility-state="ctx.visibilityState.value"
    :actions="actions"
  />
</template>
