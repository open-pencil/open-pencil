<script setup lang="ts">
import ColorPicker from './ColorPicker.vue'
import { colorToHexRaw, parseColor } from '@/engine/color'

import type { Color } from '@/types'

const props = withDefaults(
  defineProps<{
    color: Color
    editable?: boolean
  }>(),
  { editable: false }
)

const emit = defineEmits<{
  update: [color: Color]
}>()

function onHexChange(e: Event) {
  const hex = (e.target as HTMLInputElement).value
  const color = parseColor(hex.startsWith('#') ? hex : `#${hex}`)
  emit('update', { ...color, a: props.color.a })
}
</script>

<template>
  <div class="flex items-center gap-1.5">
    <ColorPicker :color="color" @update="emit('update', $event)" />
    <input
      v-if="editable"
      class="min-w-0 flex-1 border-none bg-transparent font-mono text-xs text-surface outline-none"
      :value="colorToHexRaw(color)"
      maxlength="6"
      @change="onHexChange"
    />
    <span v-else class="min-w-0 flex-1 truncate font-mono text-xs text-muted">
      {{ colorToHexRaw(color) }}
    </span>
  </div>
</template>
