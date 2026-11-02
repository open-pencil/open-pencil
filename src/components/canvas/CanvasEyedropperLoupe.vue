<script setup lang="ts">
/**
 * The eyedropper's loupe beside the pointer. Positioned with floating-ui directly, as `Tip` is:
 * a Reka tooltip would open a dismissable layer, and keyboard shortcuts wait while one is open,
 * so Escape could not leave the eyedropper.
 */
import { flip, offset, shift, useFloating } from '@floating-ui/vue'
import { tv } from 'tailwind-variants'
import { computed, shallowRef, watchEffect } from 'vue'

import { colorToCSS, colorToHexRaw } from '@open-pencil/scene-graph/color'
import { useEditor } from '@open-pencil/vue'
import { useEyedropperPreview } from '@open-pencil/vue/canvas/eyedropper'

import theme from '@/theme/canvas-eyedropper-loupe'

const loupe = tv(theme)

/** How far the loupe sits from the pointer, past the eyedropper cursor's body. */
const POINTER_OFFSET = 16
const CANVAS_PADDING = 8

const { canvas } = defineProps<{ canvas: HTMLElement | null }>()

const preview = useEyedropperPreview(useEditor())
const styles = loupe()
const content = shallowRef<HTMLElement>()
const pixelsCanvas = shallowRef<HTMLCanvasElement>()

/** The pointer, so the loupe opens below and right of it and flips inside the canvas. */
const reference = computed(() => {
  const current = preview.value
  const element = canvas
  if (!current || !element) return null
  return {
    getBoundingClientRect() {
      const bounds = element.getBoundingClientRect()
      return new DOMRect(bounds.left + current.sx, bounds.top + current.sy, 0, 0)
    }
  }
})

const { floatingStyles } = useFloating(reference, content, {
  placement: 'right-start',
  strategy: 'fixed',
  middleware: () => [
    offset({ mainAxis: POINTER_OFFSET, crossAxis: POINTER_OFFSET }),
    flip({ boundary: canvas ?? undefined, padding: CANVAS_PADDING }),
    shift({ boundary: canvas ?? undefined, padding: CANVAS_PADDING })
  ]
})

watchEffect(() => {
  const target = pixelsCanvas.value
  const pixels = preview.value?.pixels
  if (!target || !pixels) return
  target.width = pixels.size
  target.height = pixels.size
  const image = new ImageData(new Uint8ClampedArray(pixels.data), pixels.size, pixels.size)
  target.getContext('2d')?.putImageData(image, 0, 0)
})
</script>

<template>
  <Teleport v-if="preview" to="body">
    <div
      ref="content"
      :class="styles.content()"
      :style="floatingStyles"
      data-test-id="eyedropper-loupe"
    >
      <div :class="styles.loupe()">
        <canvas ref="pixelsCanvas" :class="styles.pixels()" />
        <span :class="styles.grid()" />
        <span :class="styles.centre()" />
      </div>
      <div :class="styles.value()">
        <span :class="styles.swatch()" :style="{ background: colorToCSS(preview.color) }" />
        <span data-test-id="eyedropper-loupe-value">{{ colorToHexRaw(preview.color) }}</span>
      </div>
    </div>
  </Teleport>
</template>
