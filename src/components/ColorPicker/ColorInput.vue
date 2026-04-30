<script setup lang="ts">
import { useAttrs } from 'vue'

import { ColorInputRoot } from '@open-pencil/vue'

import ColorPicker from '@/components/ColorPicker/ColorPicker.vue'

import type { Color } from '@open-pencil/core/types'
import type { OkHCLControls } from '@open-pencil/vue'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()

const {
  editable = false,
  color,
  okhcl = null
} = defineProps<{
  color: Color
  editable?: boolean
  okhcl?: OkHCLControls | null
}>()
const emit = defineEmits<{ update: [color: Color] }>()
</script>

<template>
  <ColorInputRoot
    :color="color"
    :editable="editable"
    :okhcl="okhcl"
    @update="emit('update', $event)"
  >
    <template
      #default="{ editable: isEditable, hex, updateFromHex, updateColor, okhcl: okhclControls }"
    >
      <div v-bind="attrs" class="flex items-center gap-1.5">
        <ColorPicker :color="color" :okhcl="okhclControls" @update="updateColor($event)" />
        <input
          v-if="isEditable"
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
  </ColorInputRoot>
</template>
