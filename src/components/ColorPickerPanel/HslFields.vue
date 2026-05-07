<script setup lang="ts">
import { inputNumberValue } from '@open-pencil/vue'
import { colorToCSS } from '@open-pencil/core/color'

import PickerSlider from '@/components/PickerSlider.vue'
import { useColorPickerPanelContext } from '@/components/ColorPickerPanel/context'

const ctx = useColorPickerPanelContext()
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

  <PickerSlider
    label="S"
    :model-value="ctx.hslColor.s ?? 0"
    :min="0"
    :max="100"
    :step="0.1"
    :display-value="Math.round(ctx.hslColor.s ?? 0)"
    :display-min="0"
    :display-max="100"
    :display-step="1"
    :gradient-style="ctx.sliderGradient.hslSaturation"
    :thumb-fill="colorToCSS(ctx.sliderPreview.hslSaturation)"
    test-id="color-slider-hsl-s"
    @update:model-value="ctx.updateHSLChannelValue('s', $event)"
  />

  <PickerSlider
    label="L"
    :model-value="ctx.hslColor.l ?? 0"
    :min="0"
    :max="100"
    :step="0.1"
    :display-value="Math.round(ctx.hslColor.l ?? 0)"
    :display-min="0"
    :display-max="100"
    :display-step="1"
    :gradient-style="ctx.sliderGradient.hslLightness"
    :thumb-fill="colorToCSS(ctx.sliderPreview.hslLightness)"
    test-id="color-slider-hsl-l"
    @update:model-value="ctx.updateHSLChannelValue('l', $event)"
  />

  <p class="text-[10px] leading-4 text-muted">{{ ctx.panels.colorHintHsl }}</p>
</template>
