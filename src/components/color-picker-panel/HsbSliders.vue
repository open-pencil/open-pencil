<script setup lang="ts">
import { useColorCSS } from '@open-pencil/vue/controls/color-model'
import { useMessages } from '@open-pencil/vue/i18n'

import { useColorPickerPanelContext } from '@/components/color-picker-panel/context'
import StandardColorSlider from '@/components/color-picker-panel/StandardColorSlider.vue'

const ctx = useColorPickerPanelContext()
const colorCSS = useColorCSS()
const pickerMessages = useMessages('panels/pickers')
</script>

<template>
  <StandardColorSlider
    :label="pickerMessages.saturation"
    :model-value="ctx.rekaColor"
    channel="saturation"
    color-space="hsb"
    :step="0.1"
    :thumb-fill="colorCSS(ctx.sliderPreview.hsbSaturation)"
    data-test-id="color-slider-hsb-s"
    @update="ctx.onRekaColorUpdate"
  />

  <StandardColorSlider
    :label="pickerMessages.brightness"
    :model-value="ctx.rekaColor"
    channel="brightness"
    color-space="hsb"
    :step="0.1"
    :thumb-fill="colorCSS(ctx.sliderPreview.hsbBrightness)"
    data-test-id="color-slider-hsb-b"
    @update="ctx.onRekaColorUpdate"
  />

  <p class="text-3xs leading-4 text-muted">{{ ctx.panels.colorHintHsb }}</p>
</template>
