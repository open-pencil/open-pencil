<script setup lang="ts">
import { computed } from 'vue'
import { colorToHexRaw, parseColor } from '@open-pencil/core'

import ColorPicker from './ColorPicker.vue'

import type { Color } from '@open-pencil/core'

const { editable = false, color } = defineProps<{
  color: Color
  editable?: boolean
}>()
const emit = defineEmits<{ update: [color: Color] }>()

const hex = computed(() => colorToHexRaw(color))

function updateFromHex(value: string) {
  const parsed = parseColor(value.startsWith('#') ? value : `#${value}`)
  emit('update', { ...parsed, a: color.a })
}
</script>

<template>
  <div class="flex items-center gap-1.5">
    <ColorPicker :color="color" @update="emit('update', $event)" />
    <input
      v-if="editable"
      data-test-id="color-hex-input"
      class="min-w-0 flex-1 border-none bg-transparent font-mono text-xs text-surface outline-none"
      :value="hex"
      maxlength="6"
      @change="updateFromHex(($event.target as HTMLInputElement).value)"
    />
    <span v-else class="min-w-0 flex-1 truncate font-mono text-xs text-muted">
      {{ hex }}
    </span>
  </div>
</template>
