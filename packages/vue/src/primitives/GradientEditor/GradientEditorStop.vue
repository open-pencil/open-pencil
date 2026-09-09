<script setup lang="ts">
import { Primitive } from 'reka-ui'
import { computed } from 'vue'

import { colorToCSS, colorToHexRaw } from '@open-pencil/core/color'

import type {
  GradientEditorStopActions,
  GradientEditorStopProps,
  GradientEditorStopSlots
} from '#vue/primitives/GradientEditor/types'

const {
  stop,
  index,
  active,
  dragging = false,
  interactive = true,
  removable = true,
  positionStep = 1,
  label,
  as = 'div',
  asChild = false
} = defineProps<GradientEditorStopProps>()

const emit = defineEmits<{
  select: [index: number]
  updatePosition: [index: number, position: number]
  updateColor: [index: number, hex: string]
  updateOpacity: [index: number, opacity: number]
  remove: [index: number]
}>()

defineSlots<GradientEditorStopSlots>()
defineOptions({ inheritAttrs: false })

const positionPercent = computed(() => Math.round(stop.position * 100))
const opacityPercent = computed(() => Math.round(stop.color.a * 100))
const hex = computed(() => colorToHexRaw(stop.color))
const css = computed(() => colorToCSS(stop.color))
const accessibleLabel = computed(() => label ?? `Gradient stop ${index + 1}`)
const actions: GradientEditorStopActions = {
  select: () => emit('select', index),
  updatePosition: (position) => emit('updatePosition', index, position),
  updateColor: (hexValue) => emit('updateColor', index, hexValue),
  updateOpacity: (opacity) => emit('updateOpacity', index, opacity),
  remove: () => emit('remove', index)
}

function onKeydown(event: KeyboardEvent) {
  if (!interactive) return
  const amount = positionStep * (event.shiftKey ? 10 : 1)
  let nextPosition: number | undefined
  if (event.code === 'ArrowLeft' || event.code === 'ArrowDown')
    nextPosition = positionPercent.value - amount
  else if (event.code === 'ArrowRight' || event.code === 'ArrowUp')
    nextPosition = positionPercent.value + amount
  else if (event.code === 'Home') nextPosition = 0
  else if (event.code === 'End') nextPosition = 100
  else if ((event.code === 'Delete' || event.code === 'Backspace') && removable) {
    event.preventDefault()
    event.stopPropagation()
    actions.remove()
    return
  }
  if (nextPosition === undefined) return
  event.preventDefault()
  event.stopPropagation()
  actions.updatePosition(Math.max(0, Math.min(100, nextPosition)))
}
</script>

<template>
  <Primitive
    v-bind="$attrs"
    :as="as"
    :as-child="asChild"
    :data-selected="active ? '' : undefined"
    :data-dragging="dragging ? '' : undefined"
    :role="interactive ? 'slider' : undefined"
    :tabindex="interactive ? 0 : undefined"
    :aria-label="interactive ? accessibleLabel : undefined"
    :aria-valuemin="interactive ? 0 : undefined"
    :aria-valuemax="interactive ? 100 : undefined"
    :aria-valuenow="interactive ? positionPercent : undefined"
    :aria-valuetext="interactive ? `${positionPercent}%` : undefined"
    data-slot="stop"
    @click="actions.select"
    @focus="actions.select"
    @keydown="onKeydown"
  >
    <slot
      :stop="stop"
      :index="index"
      :active="active"
      :selected="active"
      :dragging="dragging"
      :position-percent="positionPercent"
      :opacity-percent="opacityPercent"
      :hex="hex"
      :css="css"
      :actions="actions"
    />
  </Primitive>
</template>
