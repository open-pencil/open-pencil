<script setup lang="ts">
import { useLayout } from '#vue/controls/layout/use'
import { provideLayoutControls } from '#vue/primitives/LayoutControls/context'
import { proxyRefs } from 'vue'

const ctx = useLayout()
provideLayoutControls(proxyRefs(ctx) as ReturnType<typeof proxyRefs<typeof ctx>> & { node: NonNullable<typeof ctx.node.value> })
</script>

<template>
  <slot
    :editor="ctx.editor"
    :node="ctx.node.value"
    :layout-direction="ctx.layoutDirection.value"
    :is-in-auto-layout="ctx.isInAutoLayout.value"
    :is-grid="ctx.isGrid.value"
    :is-flex="ctx.isFlex.value"
    :width-sizing="ctx.widthSizing.value"
    :height-sizing="ctx.heightSizing.value"
    :width-sizing-options="ctx.widthSizingOptions.value"
    :height-sizing-options="ctx.heightSizingOptions.value"
    :align-grid="ctx.alignGrid.value"
    :show-individual-padding="ctx.showIndividualPadding.value"
    :has-uniform-padding="ctx.hasUniformPadding.value"
    :track-sizing-options="ctx.trackSizingOptions"
    :update-prop="ctx.updateProp"
    :commit-prop="ctx.commitProp"
    :set-width-sizing="ctx.setWidthSizing"
    :set-height-sizing="ctx.setHeightSizing"
    :set-uniform-padding="ctx.setUniformPadding"
    :commit-uniform-padding="ctx.commitUniformPadding"
    :set-alignment="ctx.setAlignment"
    :set-layout-direction="ctx.setLayoutDirection"
    :update-grid-track="ctx.updateGridTrack"
    :add-track="ctx.addTrack"
    :remove-track="ctx.removeTrack"
    :track-label="ctx.trackLabel"
    :toggle-individual-padding="ctx.toggleIndividualPadding"
  />
</template>
