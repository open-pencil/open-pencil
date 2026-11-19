<script setup lang="ts">
import type { VNode } from 'vue'

import type { Color } from '@open-pencil/scene-graph/primitives'
import type { OkHCLControls } from '@open-pencil/vue/controls/color-model'
import { useI18n } from '@open-pencil/vue/i18n'
import { ColorPickerRoot, type PickerCancelCause } from '@open-pencil/vue/primitives/ColorPicker'

import ColorPickerPanel from '@/components/color-picker-panel/ColorPickerPanel.vue'
import { useEyedropperKeepOpen } from '@/components/color-picker-panel/eyedropper'
import { usePopoverUI } from '@/components/ui/overlay/popover'
import FillSwatchTrigger from '@/components/ui/paint/FillSwatchTrigger.vue'
import { solidFill } from '@/components/ui/paint/swatch-trigger'

const { panels } = useI18n()
const {
  color,
  okhcl = null,
  eyedropper = true,
  escapeReverts = false
} = defineProps<{
  color: Color
  okhcl?: OkHCLControls | null
  /** Offers sampling the canvas; off where no document color is edited, as in Settings. */
  eyedropper?: boolean
  /** Escape puts back the colour the picker opened with, for a colour with no undo history. */
  escapeReverts?: boolean
}>()
defineSlots<{
  trigger?(props: { style: { background: string } }): VNode[]
}>()
const emit = defineEmits<{
  update: [color: Color]
  openChange: [open: boolean]
  /** Ends the edit made so far as one undo step, as `ColorPickerRoot` reports it. */
  commit: []
  /** As `ColorPickerRoot` reports it: a press put back, or Escape with `escapeReverts`. */
  cancel: [cause: PickerCancelCause]
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
    :escape-reverts="escapeReverts"
    :ui="{ content: cls.content }"
    @update="emit('update', $event)"
    @open-change="emit('openChange', $event)"
    @commit="emit('commit')"
    @cancel="emit('cancel', $event)"
  >
    <!-- The same swatch a fill row shows, so a colour's preview reads alike in every field. -->
    <template #trigger="trigger">
      <slot name="trigger" v-bind="trigger">
        <FillSwatchTrigger :fill="solidFill(color)" :label="panels.editColor" />
      </slot>
    </template>
    <template #default="{ color: currentColor, update }">
      <ColorPickerPanel
        :color="currentColor"
        :okhcl="okhcl"
        :eyedropper="eyedropper"
        @update="update"
      />
    </template>
  </ColorPickerRoot>
</template>
