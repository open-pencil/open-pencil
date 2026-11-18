<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger, useDirection } from 'reka-ui'
import { computed } from 'vue'

import { colorToCSS } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { useRetainedPopup } from '#vue/lifecycle/retention/popup'

import { pickerOutsideHandlers, type PickerKeepOpen } from './outside'

// Opens toward the start of the line, away from a panel at its end: left, or right when mirrored.
const direction = useDirection()
const side = computed(() => (direction.value === 'rtl' ? 'right' : 'left'))

export interface ColorPickerUI {
  content?: string
  swatch?: string
}

const {
  color,
  label = 'Edit color',
  ui,
  keepOpen
} = defineProps<{
  color: Color
  label?: string
  ui?: ColorPickerUI
  /** Whether a press outside the picker should leave it open, such as one that samples the canvas. */
  keepOpen?: PickerKeepOpen
}>()

const emit = defineEmits<{
  update: [color: Color]
  openChange: [open: boolean]
  cancel: []
}>()

const swatchBg = computed(() => colorToCSS(color))
const { open: popupOpen, portalActive } = useRetainedPopup(
  undefined,
  () => {
    emit('cancel')
    emit('openChange', false)
  },
  'picker'
)

const outside = pickerOutsideHandlers(() => keepOpen)
</script>

<template>
  <PopoverRoot v-model:open="popupOpen" @update:open="emit('openChange', $event)">
    <PopoverTrigger as-child>
      <slot name="trigger" :style="{ background: swatchBg }">
        <button
          type="button"
          :aria-label="label"
          :class="ui?.swatch"
          :style="{ background: swatchBg }"
        />
      </slot>
    </PopoverTrigger>

    <PopoverPortal v-if="portalActive">
      <PopoverContent
        :class="ui?.content"
        :side-offset="4"
        :side="side"
        data-picker-content
        @escape-key-down="emit('cancel')"
        @pointer-down-outside="outside.onPointerDownOutside"
        @focus-outside="outside.onFocusOutside"
      >
        <slot :color="color" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
