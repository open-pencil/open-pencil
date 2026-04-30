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
    :select="() => emit('select', index)"
    :update-position="(pos: number) => emit('updatePosition', index, pos)"
    :update-color="(h: string) => emit('updateColor', index, h)"
    :update-opacity="(o: number) => emit('updateOpacity', index, o)"
    :remove="() => emit('remove', index)"
  />
</template>
