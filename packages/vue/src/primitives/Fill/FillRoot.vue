<script setup lang="ts">
import { computed } from 'vue'

import type { Fill } from '@open-pencil/scene-graph'

import type { FillRootSlots } from './types'
import { useFill } from './useFill'

const { fill } = defineProps<{ fill: Fill }>()
const emit = defineEmits<{ update: [fill: Fill] }>()
defineSlots<FillRootSlots>()

const model = useFill(
  computed(() => fill),
  (updated) => emit('update', updated)
)
</script>

<template>
  <slot
    :fill="fill"
    :category="model.category.value"
    :swatch-background="model.swatchBackground.value"
    :transparent="model.transparent.value"
    :actions="model.actions"
  />
</template>
