<script setup lang="ts">
import { useTypography } from '#vue/controls/typography/use'

import type { AcceptableValue } from 'reka-ui'

const { loadFont } = defineProps<{
  loadFont?: (family: string, style: string) => Promise<unknown>
}>()

const ctx = useTypography({ loadFont })

function onAlignChange(val: AcceptableValue) {
  if (val) ctx.setAlign(val as 'LEFT' | 'CENTER' | 'RIGHT')
}

function onFormattingChange(val: AcceptableValue | AcceptableValue[]) {
  if (Array.isArray(val)) ctx.onFormattingChange(val as string[])
}
</script>

<template>
  <slot
    :node="ctx.node"
    :weights="ctx.weights"
    :missing-fonts="ctx.missingFonts"
    :has-missing-fonts="ctx.hasMissingFonts"
    :active-formatting="ctx.activeFormatting"
    :set-family="ctx.setFamily"
    :set-weight="ctx.setWeight"
    :set-direction="ctx.setDirection"
    :update-prop="ctx.updateProp"
    :commit-prop="ctx.commitProp"
    :on-align-change="onAlignChange"
    :on-formatting-change="onFormattingChange"
  />
</template>
