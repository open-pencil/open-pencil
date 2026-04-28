<script setup lang="ts">
import { computed } from 'vue'

import { useGradientStops } from '#vue/primitives/GradientEditor/useGradientStops'

import type { Fill } from '@open-pencil/core/scene-graph'

const { fill } = defineProps<{ fill: Fill }>()
const emit = defineEmits<{ update: [fill: Fill] }>()

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
</script>

<template>
  <slot
    :stops="stops"
    :subtype="subtype"
    :subtypes="subtypes"
    :active-stop-index="activeStopIndex"
    :active-color="activeColor"
    :bar-background="barBackground"
    :set-subtype="setSubtype"
    :select-stop="selectStop"
    :add-stop="addStop"
    :remove-stop="removeStop"
    :update-stop-position="updateStopPosition"
    :update-stop-color="updateStopColor"
    :update-stop-opacity="updateStopOpacity"
    :update-active-color="updateActiveColor"
    :drag-stop="dragStop"
  />
</template>
