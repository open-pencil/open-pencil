<script setup lang="ts">
import { colorToCSS } from '@open-pencil/core/color'
import { fromPercent, toPercent } from '@open-pencil/vue'

import PickerSlider from '@/components/PickerSlider.vue'
import { useColorPickerPanelContext } from '@/components/ColorPickerPanel/context'

const ctx = useColorPickerPanelContext()
</script>

<template>
  <div v-if="ctx.isOkHCLFormat && ctx.okhcl?.okhcl" class="flex flex-col gap-2">
    <PickerSlider
      label="H"
      :model-value="ctx.okhcl.okhcl.h"
      :min="0"
      :max="360"
      :step="1"
      :display-value="Math.round(ctx.okhcl.okhcl.h)"
      :display-min="0"
      :display-max="360"
      :display-step="1"
      gradient-style="background: linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000);"
      :thumb-fill="colorToCSS(ctx.okhclSliderPreview?.okhclHue ?? ctx.color)"
      test-id="color-slider-okhcl-h"
      @update:model-value="ctx.updateOkHCLChannel('h', $event)"
    />

    <PickerSlider
      label="C"
      :model-value="ctx.okhcl.okhcl.c"
      :min="0"
      :max="0.4"
      :step="0.001"
      :display-value="toPercent(ctx.okhcl.okhcl.c)"
      :display-min="0"
      :display-max="40"
      :display-step="1"
      :parse-display="fromPercent"
      :gradient-style="ctx.okhclSliderGradient?.okhclChroma ?? undefined"
      :thumb-fill="colorToCSS(ctx.okhclSliderPreview?.okhclChroma ?? ctx.color)"
      test-id="color-slider-okhcl-c"
      @update:model-value="ctx.updateOkHCLChannel('c', $event)"
    />

    <PickerSlider
      label="L"
      :model-value="ctx.okhcl.okhcl.l"
      :min="0"
      :max="1"
      :step="0.001"
      :display-value="toPercent(ctx.okhcl.okhcl.l)"
      :display-min="0"
      :display-max="100"
      :display-step="1"
      :parse-display="fromPercent"
      :gradient-style="ctx.okhclSliderGradient?.okhclLightness ?? undefined"
      :thumb-fill="colorToCSS(ctx.okhclSliderPreview?.okhclLightness ?? ctx.color)"
      test-id="color-slider-okhcl-l"
      @update:model-value="ctx.updateOkHCLChannel('l', $event)"
    />

    <PickerSlider
      label="A"
      :model-value="ctx.okhcl.okhcl.a ?? 1"
      :min="0"
      :max="1"
      :step="0.001"
      :display-value="toPercent(ctx.okhcl.okhcl.a ?? 1)"
      :display-min="0"
      :display-max="100"
      :display-step="1"
      :parse-display="fromPercent"
      checkerboard
      :gradient-style="`background: linear-gradient(to right, transparent, ${colorToCSS(ctx.color)})`"
      :thumb-fill="colorToCSS(ctx.color)"
      test-id="color-slider-okhcl-a"
      @update:model-value="ctx.updateOkHCLChannel('a', $event)"
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
