<script setup lang="ts">
import { computed, watch } from 'vue'

import type { Fill } from '@open-pencil/scene-graph'

import { useGradientStops } from '#vue/primitives/GradientEditor/useGradientStops'

const { fill } = defineProps<{ fill: Fill }>()
const emit = defineEmits<{ update: [fill: Fill] }>()
/** The selected stop, which the canvas handles can also change. */
const selectedStop = defineModel<number>('activeStopIndex')

const {
  activeStopIndex,
  stops,
  subtype,
  subtypes,
  activeColor,
  barBackground,
  setSubtype,
  selectStop,
  addStop,
  removeStop,
  updateStopPosition,
  updateStopColor,
  updateStopOpacity,
  updateActiveColor,
  dragStop
} = useGradientStops(
  computed(() => fill),
  (updated) => emit('update', updated)
)

watch(
  selectedStop,
  (index) => {
    if (index !== undefined && index !== activeStopIndex.value) activeStopIndex.value = index
  },
  { immediate: true }
)
watch(activeStopIndex, (index) => {
  if (index !== selectedStop.value) selectedStop.value = index
})

const actions = {
  setSubtype,
  selectStop,
  addStop,
  removeStop,
  updateStopPosition,
  updateStopColor,
  updateStopOpacity,
  updateActiveColor,
  dragStop
}
</script>

<template>
  <slot
    :stops="stops"
    :subtype="subtype"
    :subtypes="subtypes"
    :active-stop-index="activeStopIndex"
    :active-color="activeColor"
    :bar-background="barBackground"
    :actions="actions"
  />
</template>
