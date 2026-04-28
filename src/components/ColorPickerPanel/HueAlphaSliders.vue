<script setup lang="ts">
import { colorToCSS } from '@open-pencil/core/color'

import PickerSlider from '@/components/PickerSlider.vue'
import { useColorPickerPanelContext } from '@/components/ColorPickerPanel/context'

const ctx = useColorPickerPanelContext()
</script>

<template>
  <template v-if="ctx.fieldFormat !== 'okhcl'">
    <PickerSlider
      label="H"
      :model-value="ctx.hslColor.h ?? 0"
      :min="0"
      :max="360"
      :step="1"
      gradient-style="background: linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000);"
      :thumb-fill="colorToCSS(ctx.sliderPreview.hue)"
      :ui="{ root: 'gap-0', label: 'hidden', input: 'hidden' }"
      test-id="color-slider-hue"
      @update:model-value="ctx.updateRGBAHue"
    />

    <PickerSlider
      label="A"
      :model-value="ctx.color.a"
      :min="0"
      :max="1"
      :step="0.001"
      checkerboard
      :gradient-style="`background: linear-gradient(to right, transparent, ${colorToCSS({ ...ctx.color, a: 1 })})`"
      :thumb-fill="colorToCSS(ctx.color)"
      :ui="{ root: 'gap-0', label: 'hidden', input: 'hidden' }"
      test-id="color-slider-alpha"
      @update:model-value="ctx.updateRGBAAlpha"
    />
  </template>
</template>
