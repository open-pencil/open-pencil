<script setup lang="ts">
import { useColorCSS } from '@open-pencil/vue/controls/color-model'
import { useI18n } from '@open-pencil/vue/i18n'

import { useColorPickerPanelContext } from '@/components/color-picker-panel/context'
import StandardColorSlider from '@/components/color-picker-panel/StandardColorSlider.vue'

const ctx = useColorPickerPanelContext()
const colorToCSS = useColorCSS()
const { panels } = useI18n()
</script>

<template>
  <StandardColorSlider
    :label="panels.saturation"
    :model-value="ctx.rekaColor"
    channel="saturation"
    color-space="hsl"
    :step="0.1"
    :thumb-fill="colorToCSS(ctx.sliderPreview.hslSaturation)"
    data-test-id="color-slider-hsl-s"
    @update="ctx.onRekaColorUpdate"
  />

  <StandardColorSlider
    :label="panels.lightness"
    :model-value="ctx.rekaColor"
    channel="lightness"
    color-space="hsl"
    :step="0.1"
    :thumb-fill="colorToCSS(ctx.sliderPreview.hslLightness)"
    data-test-id="color-slider-hsl-l"
    @update="ctx.onRekaColorUpdate"
  />

  <p class="text-3xs leading-4 text-muted">{{ ctx.panels.colorHintHsl }}</p>
</template>
