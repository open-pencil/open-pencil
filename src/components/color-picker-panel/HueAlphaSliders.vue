<script setup lang="ts">
import { useMessages } from '@open-pencil/vue/i18n'
import { useColorCSS } from '@open-pencil/vue/primitives/ColorPicker'

import { useColorPickerPanelContext } from '@/components/color-picker-panel/context'
import EyedropperButton from '@/components/color-picker-panel/EyedropperButton.vue'
import StandardColorSlider from '@/components/color-picker-panel/StandardColorSlider.vue'

const ctx = useColorPickerPanelContext()
const pickerMessages = useMessages('panels/pickers')
const colorToCSS = useColorCSS()
</script>

<template>
  <!-- As in Figma: the eyedropper, then hue over alpha with no labels or values beside them. -->
  <div v-if="ctx.fieldFormat !== 'okhcl'" class="flex items-center gap-2">
    <EyedropperButton v-if="ctx.eyedropper" />
    <div class="flex min-w-0 flex-1 flex-col gap-3">
      <StandardColorSlider
        bare
        :label="pickerMessages.hue"
        :model-value="ctx.rekaColor"
        channel="hue"
        color-space="hsl"
        :thumb-fill="colorToCSS(ctx.sliderPreview.hue)"
        data-test-id="color-slider-hue"
        @update="ctx.updateRGBAHue($event.space === 'hsl' ? $event.h : 0)"
      />
      <StandardColorSlider
        bare
        :label="pickerMessages.alpha"
        :model-value="ctx.rekaColor"
        channel="alpha"
        color-space="rgb"
        :step="0.1"
        checkerboard
        :thumb-fill="colorToCSS(ctx.color)"
        data-test-id="color-slider-alpha"
        @update="ctx.updateRGBAAlpha($event.alpha)"
      />
    </div>
  </div>
</template>
