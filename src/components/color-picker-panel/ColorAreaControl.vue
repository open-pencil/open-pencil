<script setup lang="ts">
import { ColorAreaArea, ColorAreaRoot, ColorAreaThumb } from 'reka-ui'
import { computed, useTemplateRef, watchEffect } from 'vue'

import {
  SATURATION_BRIGHTNESS_SIZE,
  saturationBrightnessArea,
  saturationBrightnessPixels,
  useColorSpaces
} from '@open-pencil/vue/primitives/ColorPicker'

import { useColorPickerPanelContext } from '@/components/color-picker-panel/context'
import LeftToRight from '@/components/ui/direction/LeftToRight.vue'

const ctx = useColorPickerPanelContext()
const spaces = useColorSpaces()
// A gray has no hue of its own, so the area keeps showing the last one, as Reka's does.
let lastHue = 0
const hue = computed(() => {
  const hsb = ctx.hsbColor
  if (hsb.s > 0 && hsb.b > 0) lastHue = hsb.h
  return lastHue
})
// Reka writes its area in sRGB; in another profile the area shows the colors the canvas draws.
const areaStyle = computed(() => saturationBrightnessArea(hue.value, spaces.value))
// Colors shown in another profile than they are stored in are drawn pixel by pixel, so each is
// converted and clipped as the canvas clips it.
const pixels = computed(() => saturationBrightnessPixels(hue.value, spaces.value))
const canvas = useTemplateRef('canvas')

watchEffect(() => {
  const data = pixels.value
  const target = canvas.value
  if (!data || !target) return
  const colorSpace = spaces.value.shown
  const context = target.getContext('2d', { colorSpace })
  if (!context) return
  const size = SATURATION_BRIGHTNESS_SIZE
  context.putImageData(new ImageData(data, size, size, { colorSpace }), 0, 0)
})
</script>

<template>
  <LeftToRight>
    <ColorAreaRoot
      v-slot="{ style }"
      :model-value="ctx.rekaColor"
      color-space="hsb"
      x-channel="saturation"
      y-channel="brightness"
      @update:color="ctx.onRekaColorUpdate"
    >
      <ColorAreaArea
        class="relative aspect-square w-full cursor-crosshair overflow-hidden rounded"
        :style="pixels ? undefined : (areaStyle ?? style)"
      >
        <canvas
          v-if="pixels"
          ref="canvas"
          :width="SATURATION_BRIGHTNESS_SIZE"
          :height="SATURATION_BRIGHTNESS_SIZE"
          class="pointer-events-none absolute inset-0 size-full"
          data-test-id="color-area-pixels"
        />
        <ColorAreaThumb
          class="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
        />
      </ColorAreaArea>
    </ColorAreaRoot>
  </LeftToRight>
</template>
