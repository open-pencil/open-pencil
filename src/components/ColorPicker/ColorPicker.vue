<script setup lang="ts">
import { ColorPickerRoot } from '@open-pencil/vue'

import ColorPickerPanel from '@/components/ColorPickerPanel/ColorPickerPanel.vue'
import { usePopoverUI } from '@/components/ui/popover'

import type { Color } from '@open-pencil/core/types'
import type { OkHCLControls } from '@open-pencil/vue'

const { color, okhcl = null } = defineProps<{ color: Color; okhcl?: OkHCLControls | null }>()
const emit = defineEmits<{ update: [color: Color] }>()
const cls = usePopoverUI({ content: 'w-56 p-2' })
</script>

<template>
  <ColorPickerRoot
    :color="color"
    :content-class="cls.content"
    swatch-class="size-5 shrink-0 cursor-pointer rounded border border-border p-0"
    @update="emit('update', $event)"
  >
    <template #default="{ color: currentColor, update }">
      <ColorPickerPanel :color="currentColor" :okhcl="okhcl" @update="update($event)" />
    </template>
  </ColorPickerRoot>
</template>
