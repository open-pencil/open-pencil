<script setup lang="ts">
import { useCanvasContext } from '#vue/canvas/context'

const { canvasRef } = useCanvasContext()
</script>

<template>
  <canvas
    :ref="
      (el) => {
        canvasRef = el as HTMLCanvasElement | null
      }
    "
    v-bind="$attrs"
  />
</template>

<script lang="ts">
export default { inheritAttrs: false }
</script>
