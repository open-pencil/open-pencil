<script setup lang="ts">
import { ColorAreaArea, ColorAreaRoot, ColorAreaThumb } from 'reka-ui'
import { computed, shallowRef, useTemplateRef, watch, watchEffect } from 'vue'

import { useColorSpaces } from '@open-pencil/vue/controls/color-model'

import { AREA_SIZE, saturationBrightnessPixels } from '@/components/color-picker-panel/backgrounds'
import { useColorPickerPanelContext } from '@/components/color-picker-panel/context'
import LeftToRight from '@/components/ui/direction/LeftToRight.vue'

const ctx = useColorPickerPanelContext()
const spaces = useColorSpaces()
// A gray has no hue of its own, so the area keeps showing the last one, as Reka's does.
const hue = shallowRef(ctx.hsbColor.h)
watch(
  () => ctx.hsbColor,
  (hsb) => {
    if (hsb.s > 0 && hsb.b > 0) hue.value = hsb.h
  },
  { immediate: true }
)
// Reka writes its area as sRGB CSS; for colors stored or shown in another profile the area is
// drawn pixel by pixel, as the canvas draws those colors.
const pixels = computed(() => saturationBrightnessPixels(hue.value, spaces.value))
const canvas = useTemplateRef('canvas')

watchEffect(() => {
  const data = pixels.value
  const target = canvas.value
  if (!data || !target) return
  const colorSpace = spaces.value.shown
  const context = target.getContext('2d', { colorSpace })
  context?.putImageData(new ImageData(data, AREA_SIZE, AREA_SIZE, { colorSpace }), 0, 0)
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
        :style="pixels ? undefined : style"
      >
        <canvas
          v-if="pixels"
          :key="spaces.shown"
          ref="canvas"
          :width="AREA_SIZE"
          :height="AREA_SIZE"
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
