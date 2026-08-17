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
      :value="Math.round(ctx.hsbColor.h)"
      min="0"
      max="360"
      @change="ctx.updateHSBChannelValue('h', inputNumberValue($event))"
    />
    <input
      type="number"
      class="bg-input px-2 py-1 text-xs text-surface outline-none"
      :value="Math.round(ctx.hsbColor.s)"
      min="0"
      max="100"
      @change="ctx.updateHSBChannelValue('s', inputNumberValue($event))"
    />
    <input
      type="number"
      class="bg-input px-2 py-1 text-xs text-surface outline-none"
      :value="Math.round(ctx.hsbColor.b)"
      min="0"
      max="100"
      @change="ctx.updateHSBChannelValue('b', inputNumberValue($event))"
    />
  </div>

  <StandardColorSlider
    :label="panels.saturation"
    :model-value="ctx.rekaColor"
    channel="saturation"
    color-space="hsb"
    :step="0.1"
    :number-value="Math.round(ctx.hsbColor.s)"
    :number-min="0"
    :number-max="100"
    suffix="%"
    :thumb-fill="colorToCSS(ctx.sliderPreview.hsbSaturation)"
    data-test-id="color-slider-hsb-s"
    @update="ctx.onRekaColorUpdate"
    @update-number="ctx.updateHSBChannelValue('s', $event)"
  />

  <StandardColorSlider
    :label="panels.brightness"
    :model-value="ctx.rekaColor"
    channel="brightness"
    color-space="hsb"
    :step="0.1"
    :number-value="Math.round(ctx.hsbColor.b)"
    :number-min="0"
    :number-max="100"
    suffix="%"
    :thumb-fill="colorToCSS(ctx.sliderPreview.hsbBrightness)"
    data-test-id="color-slider-hsb-b"
    @update="ctx.onRekaColorUpdate"
    @update-number="ctx.updateHSBChannelValue('b', $event)"
  />

  <p class="text-[10px] leading-4 text-muted">{{ ctx.panels.colorHintHsb }}</p>
</template>
