<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger, useDirection } from 'reka-ui'
import { computed } from 'vue'

import { colorToCSS } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { useRetainedPopup } from '#vue/lifecycle/retention/popup'

import { usePickerGesture } from './gesture'
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
  /** Ends the edit made so far as one undo step: a press's release, or a change with none held. */
  commit: []
  /**
   * Escape during a press, or the picker put away during one: the colour from before the press
   * has just come back through `update`, and a listener that batches the press can roll it back.
   */
  cancel: []
}>()

const swatchBg = computed(() => colorToCSS(color))
let pressColor: Color = { ...color }
const gesture = usePickerGesture({
  commit: () => emit('commit'),
  cancel: () => {
    emit('update', pressColor)
    emit('cancel')
  }
})
const { open: popupOpen, portalActive } = useRetainedPopup(
  undefined,
  () => {
    gesture.abort()
    emit('openChange', false)
  },
  'picker'
)

function onPointerDown(event: PointerEvent) {
  pressColor = { ...color }
  gesture.onPointerDown(event)
}

function update(next: Color) {
  gesture.change(() => emit('update', next))
}

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
        @pointerdown.capture="onPointerDown"
        @pointer-down-outside="outside.onPointerDownOutside"
        @focus-outside="outside.onFocusOutside"
      >
        <slot :color="color" :update="update" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
