<script setup lang="ts">
import { computed } from 'vue'
import { colorToCSS } from '@open-pencil/core'

import type { Color } from '@open-pencil/core'

const { color } = defineProps<{ color: Color }>()
const emit = defineEmits<{ update: [color: Color] }>()

const swatchBg = computed(() => colorToCSS(color))

function onUpdate(c: Color) {
  emit('update', c)
}
</script>

<template>
  <slot :color="color" :swatch-bg="swatchBg" :update="onUpdate" />
</template>
