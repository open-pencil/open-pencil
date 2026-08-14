<script setup lang="ts">
import { ColorPickerRoot, useI18n } from '@open-pencil/vue'

import ColorPickerPanel from '@/components/color-picker-panel/ColorPickerPanel.vue'
import { usePopoverUI } from '@/components/ui/popover'

import type { Color } from '@open-pencil/scene-graph/primitives'
import type { OkHCLControls } from '@open-pencil/vue'
import type { VNode } from 'vue'

const { panels } = useI18n()
const { color, okhcl = null } = defineProps<{ color: Color; okhcl?: OkHCLControls | null }>()
defineSlots<{
  trigger?(props: { style: { background: string } }): VNode[]
}>()
const emit = defineEmits<{
  update: [color: Color]
  openChange: [open: boolean]
  cancel: []
}>()
const cls = usePopoverUI({ content: 'w-56 p-2' })
</script>

<template>
  <ColorPickerRoot
    :color="color"
    :label="panels.editColor"
    :ui="{
      content: cls.content,
      swatch: 'size-5 shrink-0 cursor-pointer rounded border border-border p-0'
    }"
    @update="emit('update', $event)"
    @open-change="emit('openChange', $event)"
    @cancel="emit('cancel')"
  >
    <template v-if="$slots.trigger" #trigger="trigger">
      <slot name="trigger" v-bind="trigger" />
    </template>
    <template #default="{ color: currentColor }">
      <ColorPickerPanel :color="currentColor" :okhcl="okhcl" @update="emit('update', $event)" />
    </template>
  </ColorPickerRoot>
</template>
