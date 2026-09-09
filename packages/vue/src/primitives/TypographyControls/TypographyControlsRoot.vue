<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui'

import { useTypography } from '#vue/controls/typography/use'
import type { TypographyFontLoader } from '#vue/controls/typography/use'

const { fontLoader } = defineProps<{
  fontLoader?: TypographyFontLoader
}>()

const ctx = useTypography({ fontLoader })

function onAlignChange(val: AcceptableValue) {
  if (val) ctx.setAlign(val as 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED')
}

function onFormattingChange(val: AcceptableValue | AcceptableValue[]) {
  if (Array.isArray(val)) ctx.onFormattingChange(val as string[])
}

const actions = {
  setFamily: ctx.setFamily,
  setWeight: ctx.setWeight,
  setDirection: ctx.setDirection,
  setVerticalAlign: ctx.setVerticalAlign,
  setTextCase: ctx.setTextCase,
  setTruncation: ctx.setTruncation,
  setFontFeature: ctx.setFontFeature,
  updateProp: ctx.updateProp,
  commitProp: ctx.commitProp,
  align: onAlignChange,
  formatting: onFormattingChange,
  toggleBold: ctx.toggleBold,
  toggleItalic: ctx.toggleItalic,
  toggleDecoration: ctx.toggleDecoration
}
</script>

<template>
  <slot
    :node="ctx.node"
    :weights="ctx.weights"
    :missing-fonts="ctx.missingFonts"
    :has-missing-fonts="ctx.hasMissingFonts"
    :active-formatting="ctx.activeFormatting"
    :actions="actions"
  />
</template>
