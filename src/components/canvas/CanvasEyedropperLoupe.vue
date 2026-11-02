<script setup lang="ts">
/**
 * The eyedropper's loupe, standing in for the cursor: centred on the pointer, so the outlined
 * pixel is the one a click picks. The canvas hides the system cursor while it shows; next to a
 * cursor the system draws ahead of the page, any overlay looks a few frames behind.
 */
import { tv } from 'tailwind-variants'
import { computed, useTemplateRef, watchEffect } from 'vue'

import { colorToCSS, colorToHexRaw } from '@open-pencil/scene-graph/color'
import type { EyedropperLoupe } from '@open-pencil/vue/canvas/eyedropper'

import theme from '@/theme/canvas-eyedropper-loupe'

const loupeTheme = tv(theme)

/** From the card's corner to the centre pixel's centre: 6 px padding and 4.5 pixels of 8 px. */
const LOUPE_CENTRE_OFFSET = 6 + 4.5 * 8

const { loupe } = defineProps<{ loupe: EyedropperLoupe }>()

const styles = loupeTheme()
const pixelsCanvas = useTemplateRef<HTMLCanvasElement>('pixels')

const transform = computed(
  () =>
    `translate(${loupe.clientX.value - LOUPE_CENTRE_OFFSET}px, ${loupe.clientY.value - LOUPE_CENTRE_OFFSET}px)`
)

watchEffect(() => {
  const target = pixelsCanvas.value
  const pixels = loupe.pixels.value
  if (!target || !pixels) return
  target.width = pixels.size
  target.height = pixels.size
  const image = new ImageData(new Uint8ClampedArray(pixels.data), pixels.size, pixels.size)
  target.getContext('2d')?.putImageData(image, 0, 0)
})
</script>

<template>
  <Teleport v-if="loupe.visible.value && loupe.color.value" to="body">
    <div :class="styles.content()" :style="{ transform }" data-test-id="eyedropper-loupe">
      <div :class="styles.loupe()">
        <canvas ref="pixels" :class="styles.pixels()" />
        <span :class="styles.grid()" />
        <span :class="styles.centre()" />
      </div>
      <div :class="styles.value()">
        <span :class="styles.swatch()" :style="{ background: colorToCSS(loupe.color.value) }" />
        <span data-test-id="eyedropper-loupe-value">{{ colorToHexRaw(loupe.color.value) }}</span>
      </div>
    </div>
  </Teleport>
</template>
