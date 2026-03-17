<script setup lang="ts">
import { computed } from 'vue'
import { colorToHexRaw, parseColor } from '@open-pencil/core'

import type { Color } from '@open-pencil/core'

const { color } = defineProps<{ color: Color }>()
const emit = defineEmits<{ update: [color: Color] }>()

const hex = computed(() => colorToHexRaw(color))

function updateFromHex(value: string) {
  const parsed = parseColor(value.startsWith('#') ? value : `#${value}`)
  emit('update', { ...parsed, a: color.a })
}
</script>

<template>
  <slot :color="color" :hex="hex" :update-from-hex="updateFromHex" :update="(c: Color) => emit('update', c)" />
</template>
