<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'
import { colorToCSS } from '@open-pencil/core/color'

import StandardColorSlider from '@/components/color-picker-panel/StandardColorSlider.vue'
import { useColorPickerPanelContext } from '@/components/color-picker-panel/context'

const ctx = useColorPickerPanelContext()
const { panels } = useI18n()
</script>

<template>
  <template v-if="ctx.fieldFormat !== 'okhcl'">
    <StandardColorSlider
      :label="panels.hue"
      :model-value="ctx.rekaColor"
      channel="hue"
      color-space="hsl"
      :number-value="Math.round(ctx.hslColor.h ?? 0)"
      :number-min="0"
      :number-max="360"
      :thumb-fill="colorToCSS(ctx.sliderPreview.hue)"
      data-test-id="color-slider-hue"
      @update="ctx.updateRGBAHue($event.space === 'hsl' ? $event.h : 0)"
      @update-number="ctx.updateRGBAHue"
    />

    <StandardColorSlider
      :label="panels.alpha"
      :model-value="ctx.rekaColor"
      channel="alpha"
      color-space="rgb"
      :step="0.1"
      :number-value="Math.round(ctx.color.a * 100)"
      :number-min="0"
      :number-max="100"
      suffix="%"
      checkerboard
      :thumb-fill="colorToCSS(ctx.color)"
      data-test-id="color-slider-alpha"
      @update="ctx.updateRGBAAlpha($event.alpha)"
      @update-number="ctx.updateRGBAAlpha($event / 100)"
    />
  </template>
</template>
