<script setup lang="ts">
import { ref } from 'vue'

import type { GradientStop } from '@open-pencil/core'

const { stops } = defineProps<{
  stops: GradientStop[]
  activeStopIndex: number
  barBackground: string
}>()

const emit = defineEmits<{
  selectStop: [index: number]
  dragStop: [index: number, position: number]
}>()

const barRef = ref<HTMLElement | null>(null)
const draggingIndex = ref<number | null>(null)

function onStopPointerDown(index: number, e: PointerEvent) {
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

function setBarRef(el: unknown) {
  barRef.value = el instanceof HTMLElement ? el : null
}

defineExpose({ barRef })
</script>

<template>
  <slot
    :stops="stops"
    :active-stop-index="activeStopIndex"
    :bar-background="barBackground"
    :bar-ref="setBarRef"
    :on-stop-pointer-down="onStopPointerDown"
    :on-pointer-move="onPointerMove"
    :on-pointer-up="onPointerUp"
    :dragging-index="draggingIndex"
  />
</template>
