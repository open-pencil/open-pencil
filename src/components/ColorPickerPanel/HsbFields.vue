<script setup lang="ts">
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
      :value="Math.round(ctx.hsbColor.h)"
      min="0"
      max="360"
      @change="ctx.updateHSBChannelValue('h', +($event.target as HTMLInputElement).value)"
    />
    <input
      type="number"
      class="bg-input px-2 py-1 text-xs text-surface outline-none"
      :value="Math.round(ctx.hsbColor.s)"
      min="0"
      max="100"
      @change="ctx.updateHSBChannelValue('s', +($event.target as HTMLInputElement).value)"
    />
    <input
      type="number"
      class="bg-input px-2 py-1 text-xs text-surface outline-none"
      :value="Math.round(ctx.hsbColor.b)"
      min="0"
      max="100"
      @change="ctx.updateHSBChannelValue('b', +($event.target as HTMLInputElement).value)"
    />
  </div>

  <PickerSlider
    label="S"
    :model-value="ctx.hsbColor.s"
    :min="0"
    :max="100"
    :step="0.1"
    :display-value="Math.round(ctx.hsbColor.s)"
    :display-min="0"
    :display-max="100"
    :display-step="1"
    :gradient-style="ctx.sliderGradient.hsbSaturation"
    :thumb-fill="colorToCSS(ctx.sliderPreview.hsbSaturation)"
    test-id="color-slider-hsb-s"
    @update:model-value="ctx.updateHSBChannelValue('s', $event)"
  />

  <PickerSlider
    label="B"
    :model-value="ctx.hsbColor.b"
    :min="0"
    :max="100"
    :step="0.1"
    :display-value="Math.round(ctx.hsbColor.b)"
    :display-min="0"
    :display-max="100"
    :display-step="1"
    :gradient-style="ctx.sliderGradient.hsbBrightness"
    :thumb-fill="colorToCSS(ctx.sliderPreview.hsbBrightness)"
    test-id="color-slider-hsb-b"
    @update:model-value="ctx.updateHSBChannelValue('b', $event)"
  />

  <p class="text-[10px] leading-4 text-muted">{{ ctx.panels.colorHintHsb }}</p>
</template>
