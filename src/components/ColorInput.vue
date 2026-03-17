<script setup lang="ts">
import type { Color } from '@open-pencil/core'
import { ColorInputRoot } from '@open-pencil/vue'

import ColorPicker from './ColorPicker.vue'

const { editable = false } = defineProps<{
  color: Color
  editable?: boolean
}>()
const emit = defineEmits<{ update: [color: Color] }>()
</script>

<template>
  <ColorInputRoot
    :color="color"
    @update="emit('update', $event)"
    v-slot="{ hex, updateFromHex, update }"
  >
    <div class="flex items-center gap-1.5">
      <ColorPicker :color="color" @update="update" />
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
  </ColorInputRoot>
</template>
