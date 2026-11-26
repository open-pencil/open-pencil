<script setup lang="ts">
/**
 * The eyedropper's loupe, standing in for the cursor: centred on the pointer, so the outlined
 * pixel is the one a click picks. The canvas hides the system cursor while it shows; next to a
 * cursor the system draws ahead of the page, any overlay looks a few frames behind.
 */
import { tv } from 'tailwind-variants'
import { computed, useTemplateRef, watchEffect } from 'vue'

import { colorToHexRaw } from '@open-pencil/scene-graph/color'
import type { EyedropperLoupe } from '@open-pencil/vue/canvas/eyedropper'
import { useColorCSS, useColorSpaces } from '@open-pencil/vue/controls/color-model'

import { remToPx } from '@/app/shell/root-font-size'
import theme from '@/theme/canvas/eyedropper-loupe'

const loupeTheme = tv(theme)
const colorCSS = useColorCSS()

/** From the card's corner to the centre pixel's centre: 0.375rem padding and 4.5 pixels of 0.5rem. */
const LOUPE_CENTRE_OFFSET_REM = 0.375 + 4.5 * 0.5

const { loupe } = defineProps<{ loupe: EyedropperLoupe }>()

const styles = loupeTheme()
const pixelsCanvas = useTemplateRef<HTMLCanvasElement>('pixels')

const transform = computed(() => {
  const offset = remToPx(LOUPE_CENTRE_OFFSET_REM)
  return `translate(${loupe.clientX.value - offset}px, ${loupe.clientY.value - offset}px)`
})

const spaces = useColorSpaces()

// The samples are in the document's profile; the canvas shows them as the scene canvas does,
// converting into the profile it presents.
watchEffect(() => {
  const target = pixelsCanvas.value
  const pixels = loupe.pixels.value
  if (!target || !pixels) return
  const { stored, shown } = spaces.value
  target.width = pixels.size
  target.height = pixels.size
  const data = new Uint8ClampedArray(pixels.data)
  const image = new ImageData(data, pixels.size, pixels.size, { colorSpace: stored })
  target.getContext('2d', { colorSpace: shown })?.putImageData(image, 0, 0)
})
</script>

<template>
  <Teleport v-if="loupe.visible.value && loupe.color.value" to="body">
    <div :class="styles.content()" :style="{ transform }" data-test-id="eyedropper-loupe">
      <div :class="styles.loupe()">
        <canvas :key="spaces.shown" ref="pixels" :class="styles.pixels()" />
        <span :class="styles.grid()" />
        <span :class="styles.centre()" />
      </div>
      <div :class="styles.value()">
        <span :class="styles.swatch()" :style="{ background: colorCSS(loupe.color.value) }" />
        <span data-test-id="eyedropper-loupe-value">{{ colorToHexRaw(loupe.color.value) }}</span>
      </div>
    </div>
  </Teleport>
</template>
