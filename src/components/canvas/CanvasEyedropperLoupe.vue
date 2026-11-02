<script setup lang="ts">
/**
 * The eyedropper's loupe beside the pointer. It moves with each pointer move, placed by a
 * transform as a dragged comment pin is; floating-ui would place it a promise later, and a Reka
 * tooltip would open a dismissable layer, which keyboard shortcuts wait on.
 */
import { useElementSize } from '@vueuse/core'
import { tv } from 'tailwind-variants'
import { computed, toRef, useTemplateRef, watchEffect } from 'vue'

import { colorToCSS, colorToHexRaw } from '@open-pencil/scene-graph/color'
import { useEditor } from '@open-pencil/vue'
import { useEyedropperLoupe } from '@open-pencil/vue/canvas/eyedropper'

import theme from '@/theme/canvas-eyedropper-loupe'

const loupeTheme = tv(theme)

/** How far the loupe sits from the pointer, past the eyedropper cursor's body. */
const POINTER_OFFSET = 16
/** How close the loupe comes to the canvas's edges before it flips to the pointer's other side. */
const CANVAS_PADDING = 8

const { canvas } = defineProps<{ canvas: HTMLElement | null }>()

const loupe = useEyedropperLoupe(
  useEditor(),
  toRef(() => canvas)
)
const styles = loupeTheme()
const card = useTemplateRef<HTMLElement>('card')
const pixelsCanvas = useTemplateRef<HTMLCanvasElement>('pixels')
const size = useElementSize(card, undefined, { box: 'border-box' })

/** Below and right of the pointer, or above and left where the canvas ends. */
function place(pointer: number, extent: number, limit: number) {
  const after = pointer + POINTER_OFFSET
  if (after + extent <= limit - CANVAS_PADDING) return after
  return Math.max(CANVAS_PADDING, pointer - POINTER_OFFSET - extent)
}

const transform = computed(() => {
  const x = place(loupe.x.value, size.width.value, loupe.width.value)
  const y = place(loupe.y.value, size.height.value, loupe.height.value)
  return `translate(${x}px, ${y}px)`
})

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
  <div
    v-if="loupe.visible.value && loupe.color.value"
    ref="card"
    :class="styles.content()"
    :style="{ transform }"
    data-test-id="eyedropper-loupe"
  >
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
</template>
