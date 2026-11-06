<script setup lang="ts">
import { templateRef } from '@vueuse/core'
import { watchEffect } from 'vue'

import { useCanvasContext } from '#vue/canvas/context'

const { canvasRef, cursor } = useCanvasContext()
const surfaceRef = templateRef<HTMLCanvasElement>('surfaceRef')

watchEffect(() => {
  canvasRef.value = surfaceRef.value
})
</script>

<template>
  <canvas ref="surfaceRef" v-bind="$attrs" :style="{ cursor }" />
</template>

<script lang="ts">
export default { inheritAttrs: false }
</script>
