<script setup lang="ts">
import { inputNumberValue, useI18n } from '@open-pencil/vue'
import { colorToCSS } from '@open-pencil/core/color'

import StandardColorSlider from '@/components/color-picker-panel/StandardColorSlider.vue'
import { useColorPickerPanelContext } from '@/components/color-picker-panel/context'

const ctx = useColorPickerPanelContext()
const { panels } = useI18n()
</script>

<template>
  <div
    class="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-px overflow-hidden rounded border border-border bg-border"
  >
    <input
      type="number"
      class="bg-input px-2 py-1 text-xs text-surface outline-none"
      :value="Math.round(ctx.hslColor.h ?? 0)"
      min="0"
      max="360"
      @change="ctx.updateHSLChannelValue('h', inputNumberValue($event))"
    />
    <input
      type="number"
      class="bg-input px-2 py-1 text-xs text-surface outline-none"
      :value="Math.round(ctx.hslColor.s ?? 0)"
      min="0"
      max="100"
      @change="ctx.updateHSLChannelValue('s', inputNumberValue($event))"
    />
    <input
      type="number"
      class="bg-input px-2 py-1 text-xs text-surface outline-none"
      :value="Math.round(ctx.hslColor.l ?? 0)"
      min="0"
      max="100"
      @change="ctx.updateHSLChannelValue('l', inputNumberValue($event))"
    />
  </div>

  <StandardColorSlider
    :label="panels.saturation"
    :model-value="ctx.rekaColor"
    channel="saturation"
    color-space="hsl"
    :step="0.1"
    :number-value="Math.round(ctx.hslColor.s ?? 0)"
    :number-min="0"
    :number-max="100"
    suffix="%"
    :thumb-fill="colorToCSS(ctx.sliderPreview.hslSaturation)"
    data-test-id="color-slider-hsl-s"
    @update="ctx.onRekaColorUpdate"
    @update-number="ctx.updateHSLChannelValue('s', $event)"
  />

  <StandardColorSlider
    :label="panels.lightness"
    :model-value="ctx.rekaColor"
    channel="lightness"
    color-space="hsl"
    :step="0.1"
    :number-value="Math.round(ctx.hslColor.l ?? 0)"
    :number-min="0"
    :number-max="100"
    suffix="%"
    :thumb-fill="colorToCSS(ctx.sliderPreview.hslLightness)"
    data-test-id="color-slider-hsl-l"
    @update="ctx.onRekaColorUpdate"
    @update-number="ctx.updateHSLChannelValue('l', $event)"
  />

  <p class="text-[10px] leading-4 text-muted">{{ ctx.panels.colorHintHsl }}</p>
</template>
