<script setup lang="ts">
import { useColorCSS } from '@open-pencil/vue/controls/color-model'
import { useMessages } from '@open-pencil/vue/i18n'

import { useColorPickerPanelContext } from '@/components/color-picker-panel/context'
import StandardColorSlider from '@/components/color-picker-panel/StandardColorSlider.vue'

const ctx = useColorPickerPanelContext()
const pickerMessages = useMessages('panels/pickers')
const colorToCSS = useColorCSS()
</script>

<template>
  <StandardColorSlider
    :label="pickerMessages.saturation"
    :model-value="ctx.rekaColor"
    channel="saturation"
    color-space="hsl"
    :step="0.1"
    :thumb-fill="colorToCSS(ctx.sliderPreview.hslSaturation)"
    data-test-id="color-slider-hsl-s"
    @update="ctx.onRekaColorUpdate"
  />

  <StandardColorSlider
    :label="pickerMessages.lightness"
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
