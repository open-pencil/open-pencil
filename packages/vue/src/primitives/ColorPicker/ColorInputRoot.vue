<script setup lang="ts">
import { computed } from 'vue'
import { colorToHexRaw, parseColor } from '@open-pencil/core/color'

import type { Color } from '@open-pencil/core/types'
import type { OkHCLControls } from '#vue/primitives/ColorPicker/types'

const {
  color,
  editable = false,
  okhcl = null
} = defineProps<{
  color: Color
  editable?: boolean
  okhcl?: OkHCLControls | null
}>()

const emit = defineEmits<{ update: [color: Color] }>()

const hex = computed(() => colorToHexRaw(color))

function updateFromHex(value: string) {
  const parsed = parseColor(value.startsWith('#') ? value : `#${value}`)
  emit('update', { ...parsed, a: color.a })
}

const actions = {
  updateFromHex,
  updateColor: (nextColor: Color) => emit('update', nextColor)
}
</script>

<template>
  <slot :color="color" :editable="editable" :hex="hex" :actions="actions" :okhcl="okhcl" />
</template>
