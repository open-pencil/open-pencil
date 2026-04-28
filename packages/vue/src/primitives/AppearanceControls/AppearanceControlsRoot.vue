<script setup lang="ts">
import { useAppearance } from '#vue/controls/appearance/use'

const ctx = useAppearance()
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
    :update-prop="ctx.updateProp"
    :commit-prop="ctx.commitProp"
    :toggle-visibility="ctx.toggleVisibility"
    :toggle-independent-corners="ctx.toggleIndependentCorners"
    :update-corner-prop="ctx.updateCornerProp"
    :commit-corner-prop="ctx.commitCornerProp"
  />
</template>
