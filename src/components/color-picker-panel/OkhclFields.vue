<script setup lang="ts">
import {
  linearGradientCSS,
  toPercent,
  useColorCSS,
  useColorSpaces
} from '@open-pencil/vue/controls/color-model'
import { useI18n } from '@open-pencil/vue/i18n'

import { useColorPickerPanelContext } from '@/components/color-picker-panel/context'
import EyedropperButton from '@/components/color-picker-panel/EyedropperButton.vue'
import OkhclChannelSlider from '@/components/color-picker-panel/OkhclChannelSlider.vue'

const ctx = useColorPickerPanelContext()
const colorToCSS = useColorCSS()
const spaces = useColorSpaces()
const alphaGradient = () => {
  const color = { ...ctx.color, a: 1 }
  const stops = [{ color: { ...color, a: 0 } }, { color }]
  return `background: ${linearGradientCSS('to right', stops, spaces.value)}`
}
const { panels } = useI18n()
const percentText = (value: number) => `${Math.round(toPercent(value))}%`
</script>

<template>
  <div v-if="ctx.isOkHCLFormat && ctx.okhcl?.okhcl" class="flex flex-col gap-2">
    <!-- The eyedropper beside the channels, as it stands beside hue and alpha in other formats. -->
    <div class="flex items-center gap-2">
      <EyedropperButton v-if="ctx.eyedropper" />
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <OkhclChannelSlider
          :label="panels.hue"
          :model-value="ctx.okhcl.okhcl.h"
          :min="0"
          :max="360"
          :step="1"
          :thumb-fill="colorToCSS(ctx.okhclSliderPreview?.okhclHue ?? ctx.color)"
          gradient="background: linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000);"
          data-test-id="color-slider-okhcl-h"
          @update:model-value="ctx.updateOkHCLChannel('h', $event)"
        />

        <OkhclChannelSlider
          :label="panels.chroma"
          :model-value="ctx.okhcl.okhcl.c"
          :min="0"
          :max="0.4"
          :step="0.001"
          :gradient="ctx.okhclSliderGradient?.okhclChroma ?? undefined"
          :thumb-fill="colorToCSS(ctx.okhclSliderPreview?.okhclChroma ?? ctx.color)"
          :format-value-text="percentText"
          data-test-id="color-slider-okhcl-c"
          @update:model-value="ctx.updateOkHCLChannel('c', $event)"
        />

        <OkhclChannelSlider
          :label="panels.lightness"
          :model-value="ctx.okhcl.okhcl.l"
          :min="0"
          :max="1"
          :step="0.001"
          :gradient="ctx.okhclSliderGradient?.okhclLightness ?? undefined"
          :thumb-fill="colorToCSS(ctx.okhclSliderPreview?.okhclLightness ?? ctx.color)"
          :format-value-text="percentText"
          data-test-id="color-slider-okhcl-l"
          @update:model-value="ctx.updateOkHCLChannel('l', $event)"
        />

        <OkhclChannelSlider
          :label="panels.alpha"
          :model-value="ctx.okhcl.okhcl.a ?? 1"
          :min="0"
          :max="1"
          :step="0.001"
          checkerboard
          :gradient="alphaGradient()"
          :thumb-fill="colorToCSS(ctx.color)"
          :format-value-text="percentText"
          data-test-id="color-slider-okhcl-a"
          @update:model-value="ctx.updateOkHCLChannel('a', $event)"
        />
      </div>
    </div>

    <div class="flex items-start justify-between gap-2 text-3xs text-muted">
      <p class="min-w-0 flex-1 leading-4 break-words">{{ ctx.panels.colorHintOkhcl }}</p>
      <span
        v-if="ctx.okhcl.previewColorSpace"
        class="shrink-0 rounded border border-border px-1 py-0.5 text-3xs uppercase"
      >
        {{ ctx.okhcl.previewColorSpace }}
      </span>
    </div>
    <p v-if="ctx.okhcl.clipped" class="text-3xs leading-4 text-warning">
      {{ ctx.panels.colorPreviewClipped({ space: ctx.okhcl.previewColorSpace ?? 'display-p3' }) }}
    </p>
  </div>
</template>
