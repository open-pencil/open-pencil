<script setup lang="ts">
import { ColorAreaArea, ColorAreaRoot, ColorAreaThumb } from 'reka-ui'
import { computed } from 'vue'

import { saturationBrightnessArea, useColorSpace } from '@open-pencil/vue/primitives/ColorPicker'

import { useColorPickerPanelContext } from '@/components/color-picker-panel/context'
import LeftToRight from '@/components/ui/direction/LeftToRight.vue'

const ctx = useColorPickerPanelContext()
const space = useColorSpace()
// A gray has no hue of its own, so the area keeps showing the last one, as Reka's does.
let lastHue = 0
const hue = computed(() => {
  const hsb = ctx.hsbColor
  if (hsb.s > 0 && hsb.b > 0) lastHue = hsb.h
  return lastHue
})
// Reka writes its area in sRGB; in another profile the area shows the colors the canvas draws.
const areaStyle = computed(() => saturationBrightnessArea(hue.value, space.value))
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
        :style="areaStyle ?? style"
      >
        <ColorAreaThumb
          class="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
        />
      </ColorAreaArea>
    </ColorAreaRoot>
  </LeftToRight>
</template>
