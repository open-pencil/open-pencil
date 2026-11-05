<script setup lang="ts">
import type { VNode } from 'vue'

import type { Color } from '@open-pencil/scene-graph/primitives'
import type { OkHCLControls } from '@open-pencil/vue/controls/color-model'
import { useI18n } from '@open-pencil/vue/i18n'
import { ColorPickerRoot } from '@open-pencil/vue/primitives/ColorPicker'

import ColorPickerPanel from '@/components/color-picker-panel/ColorPickerPanel.vue'
import { useEyedropperKeepOpen } from '@/components/color-picker-panel/eyedropper'
import { usePopoverUI } from '@/components/ui/overlay/popover'

const { panels } = useI18n()
const {
  color,
  okhcl = null,
  eyedropper = true
} = defineProps<{
  color: Color
  okhcl?: OkHCLControls | null
  /** Offers sampling the canvas; off where no document color is edited, as in Settings. */
  eyedropper?: boolean
}>()
defineSlots<{
  trigger?(props: { style: { background: string } }): VNode[]
}>()
const emit = defineEmits<{
  update: [color: Color]
  openChange: [open: boolean]
  cancel: []
}>()
const cls = usePopoverUI({ content: 'w-56 p-2' })
// Settings has no document behind it to sample, nor always an editor to sample with.
const keepOpen = eyedropper ? useEyedropperKeepOpen() : undefined
</script>

<template>
  <ColorPickerRoot
    :color="color"
    :label="panels.editColor"
    :keep-open="keepOpen"
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
      <ColorPickerPanel
        :color="currentColor"
        :okhcl="okhcl"
        :eyedropper="eyedropper"
        @update="emit('update', $event)"
      />
    </template>
  </ColorPickerRoot>
</template>
