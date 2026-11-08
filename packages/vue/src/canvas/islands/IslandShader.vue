<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { onScopeDispose, useTemplateRef, watch } from 'vue'

import { useShaderFrames } from '#vue/canvas/surface/shader/frames'
import { useEditor } from '#vue/editor/context'

/**
 * A shader fill behind an island layer's content: the still frame the document keeps, and over
 * it each frame the canvas's own player draws for that shader, copied as it is drawn. The layer
 * is positioned and isolated by the projection, so this sits under everything it holds.
 */
const { image, frame } = defineProps<{
  /** The image the shader's paint shows, which names its player. */
  image: string
  /** The still frame the document keeps, shown until a frame is drawn and where none can be. */
  frame?: string
}>()

const host = useTemplateRef<HTMLElement>('host')
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const { width, height } = useElementSize(host)
// The frames of the canvas this island is drawn over, or of its editor outside any canvas.
const frames = useShaderFrames(useEditor())

function draw(source: CanvasImageSource) {
  const target = canvas.value
  const context = target?.getContext('2d')
  if (!target || !context) return
  const ratio = window.devicePixelRatio || 1
  const w = Math.max(1, Math.round(width.value * ratio))
  const h = Math.max(1, Math.round(height.value * ratio))
  if (target.width !== w || target.height !== h) {
    target.width = w
    target.height = h
  }
  context.drawImage(source, 0, 0, w, h)
}

let stop: (() => void) | null = null
watch(
  () => image,
  (value) => {
    stop?.()
    // Another shader's last frame would cover this one's still frame until it draws.
    const target = canvas.value
    target?.getContext('2d')?.clearRect(0, 0, target.width, target.height)
    stop = frames.listen(value, draw)
  },
  { immediate: true }
)
onScopeDispose(() => stop?.())
</script>

<template>
  <div
    ref="host"
    aria-hidden="true"
    style="position: absolute; inset: 0; z-index: -1; overflow: hidden; pointer-events: none"
  >
    <img
      v-if="frame"
      :src="frame"
      alt=""
      style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover"
    />
    <canvas
      ref="canvas"
      style="position: absolute; inset: 0; width: 100%; height: 100%; display: block"
    />
  </div>
</template>
