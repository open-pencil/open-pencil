<script setup lang="ts">
import { useLayout } from '#vue/controls/layout/use'
import { provideLayoutControls } from '#vue/primitives/LayoutControls/context'
import { proxyRefs } from 'vue'

const ctx = useLayout()
const actions = {
  updateProp: ctx.updateProp,
  updateSizeLimit: ctx.updateSizeLimit,
  setSizeLimitToCurrent: ctx.setSizeLimitToCurrent,
  commitSizeLimit: ctx.commitSizeLimit,
  addSizeLimit: ctx.addSizeLimit,
  removeSizeLimit: ctx.removeSizeLimit,
  commitProp: ctx.commitProp,
  setWidthSizing: ctx.setWidthSizing,
  setHeightSizing: ctx.setHeightSizing,
  setHorizontalPadding: ctx.setHorizontalPadding,
  commitHorizontalPadding: ctx.commitHorizontalPadding,
  setVerticalPadding: ctx.setVerticalPadding,
  commitVerticalPadding: ctx.commitVerticalPadding,
  setAlignment: ctx.setAlignment,
  setGapAuto: ctx.setGapAuto,
  setLayoutDirection: ctx.setLayoutDirection,
  updateGridTrack: ctx.updateGridTrack,
  addTrack: ctx.addTrack,
  removeTrack: ctx.removeTrack,
  toggleIndividualPadding: ctx.toggleIndividualPadding
}
provideLayoutControls(
  proxyRefs(ctx) as ReturnType<typeof proxyRefs<typeof ctx>> & {
    node: NonNullable<typeof ctx.node.value>
  }
)
</script>

<template>
  <slot
    :editor="ctx.editor"
    :node="ctx.node.value"
    :layout-direction="ctx.layoutDirection.value"
    :gap-auto="ctx.gapAuto.value"
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
    :has-symmetric-padding="ctx.hasSymmetricPadding.value"
    :track-sizing-options="ctx.trackSizingOptions"
    :track-label="ctx.trackLabel"
    :actions="actions"
  />
</template>
