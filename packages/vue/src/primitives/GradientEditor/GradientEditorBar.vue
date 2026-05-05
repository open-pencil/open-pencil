<script setup lang="ts">
import { templateRef } from '@vueuse/core'
import { ref } from 'vue'

import type { GradientStop } from '@open-pencil/core/scene-graph'

const { stops, ui } = defineProps<{
  stops: GradientStop[]
  activeStopIndex: number
  barBackground: string
  ui?: {
    bar?: string
  }
}>()

const emit = defineEmits<{
  selectStop: [index: number]
  dragStop: [index: number, position: number]
}>()

const barRef = templateRef<HTMLElement>('barRef')
const draggingIndex = ref<number | null>(null)

function stopPointerDown(index: number, e: PointerEvent) {
  emit('selectStop', index)
  draggingIndex.value = index
  barRef.value?.setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  const el = barRef.value
  if (!el || draggingIndex.value === null || !el.hasPointerCapture(e.pointerId)) return
  const rect = el.getBoundingClientRect()
  const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  emit('dragStop', draggingIndex.value, pos)
}

function onPointerUp() {
  draggingIndex.value = null
}

const actions = {
  stopPointerDown
}

defineExpose({ barRef })
</script>

<template>
  <div
    ref="barRef"
    :class="ui?.bar"
    :style="{ background: barBackground }"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
  >
    <slot
      :stops="stops"
      :active-stop-index="activeStopIndex"
      :bar-background="barBackground"
      :actions="actions"
      :dragging-index="draggingIndex"
    />
  </div>
</template>
