<script setup lang="ts">
import { colorToCSS } from '@open-pencil/core/color'
import { fromPercent, toPercent, useI18n } from '@open-pencil/vue'

import OkhclChannelSlider from '@/components/color-picker-panel/OkhclChannelSlider.vue'
import { useColorPickerPanelContext } from '@/components/color-picker-panel/context'

const ctx = useColorPickerPanelContext()
const { panels } = useI18n()
const percentText = (value: number) => `${Math.round(toPercent(value))}%`
</script>

<template>
  <div v-if="ctx.isOkHCLFormat && ctx.okhcl?.okhcl" class="flex flex-col gap-2">
    <OkhclChannelSlider
      :label="panels.hue"
      :model-value="ctx.okhcl.okhcl.h"
      :min="0"
      :max="360"
      :step="1"
      :display-value="Math.round(ctx.okhcl.okhcl.h)"
      :display-min="0"
      :display-max="360"
      :thumb-fill="colorToCSS(ctx.okhclSliderPreview?.okhclHue ?? ctx.color)"
      gradient="background: linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000);"
      data-test-id="color-slider-okhcl-h"
      @update:model-value="ctx.updateOkHCLChannel('h', $event)"
      @update-display="ctx.updateOkHCLChannel('h', $event)"
    />

    <OkhclChannelSlider
      :label="panels.chroma"
      :model-value="ctx.okhcl.okhcl.c"
      :min="0"
      :max="0.4"
      :step="0.001"
      :display-value="toPercent(ctx.okhcl.okhcl.c)"
      :display-min="0"
      :display-max="40"
      suffix="%"
      :gradient="ctx.okhclSliderGradient?.okhclChroma ?? undefined"
      :thumb-fill="colorToCSS(ctx.okhclSliderPreview?.okhclChroma ?? ctx.color)"
      :format-value-text="percentText"
      data-test-id="color-slider-okhcl-c"
      @update:model-value="ctx.updateOkHCLChannel('c', $event)"
      @update-display="ctx.updateOkHCLChannel('c', fromPercent($event))"
    />

    <OkhclChannelSlider
      :label="panels.lightness"
      :model-value="ctx.okhcl.okhcl.l"
      :min="0"
      :max="1"
      :step="0.001"
      :display-value="toPercent(ctx.okhcl.okhcl.l)"
      :display-min="0"
      :display-max="100"
      suffix="%"
      :gradient="ctx.okhclSliderGradient?.okhclLightness ?? undefined"
      :thumb-fill="colorToCSS(ctx.okhclSliderPreview?.okhclLightness ?? ctx.color)"
      :format-value-text="percentText"
      data-test-id="color-slider-okhcl-l"
      @update:model-value="ctx.updateOkHCLChannel('l', $event)"
      @update-display="ctx.updateOkHCLChannel('l', fromPercent($event))"
    />

    <OkhclChannelSlider
      :label="panels.alpha"
      :model-value="ctx.okhcl.okhcl.a ?? 1"
      :min="0"
      :max="1"
      :step="0.001"
      :display-value="toPercent(ctx.okhcl.okhcl.a ?? 1)"
      :display-min="0"
      :display-max="100"
      suffix="%"
      checkerboard
      :gradient="`background: linear-gradient(to right, transparent, ${colorToCSS({ ...ctx.color, a: 1 })})`"
      :thumb-fill="colorToCSS(ctx.color)"
      :format-value-text="percentText"
      data-test-id="color-slider-okhcl-a"
      @update:model-value="ctx.updateOkHCLChannel('a', $event)"
      @update-display="ctx.updateOkHCLChannel('a', fromPercent($event))"
    />

    <div class="flex items-start justify-between gap-2 text-[10px] text-muted">
      <p class="min-w-0 flex-1 leading-4 break-words">{{ ctx.panels.colorHintOkhcl }}</p>
      <span
        v-if="ctx.okhcl.previewColorSpace"
        class="shrink-0 rounded border border-border px-1 py-0.5 text-[10px] uppercase"
      >
        {{ ctx.okhcl.previewColorSpace }}
      </span>
    </div>
    <p v-if="ctx.okhcl.clipped" class="text-[10px] leading-4 text-[var(--color-warning-text)]">
      {{ ctx.panels.colorPreviewClipped({ space: ctx.okhcl.previewColorSpace ?? 'display-p3' }) }}
    </p>
  </div>
</template>
