<script setup lang="ts">
import { computed } from 'vue'
import { colorToCSS, colorToHexRaw } from '@open-pencil/core/color'

import type { GradientStop } from '@open-pencil/core/scene-graph'

const { stop, index, active } = defineProps<{
  stop: GradientStop
  index: number
  active: boolean
}>()

const emit = defineEmits<{
  select: [index: number]
  updatePosition: [index: number, position: number]
  updateColor: [index: number, hex: string]
  updateOpacity: [index: number, opacity: number]
  remove: [index: number]
}>()

const positionPercent = computed(() => Math.round(stop.position * 100))
const opacityPercent = computed(() => Math.round(stop.color.a * 100))
const hex = computed(() => colorToHexRaw(stop.color))
const css = computed(() => colorToCSS(stop.color))
const actions = {
  select: () => emit('select', index),
  updatePosition: (pos: number) => emit('updatePosition', index, pos),
  updateColor: (hexValue: string) => emit('updateColor', index, hexValue),
  updateOpacity: (opacity: number) => emit('updateOpacity', index, opacity),
  remove: () => emit('remove', index)
}
</script>

<template>
  <slot
    :stop="stop"
    :index="index"
    :active="active"
    :position-percent="positionPercent"
    :opacity-percent="opacityPercent"
    :hex="hex"
    :css="css"
    :actions="actions"
  />
</template>
