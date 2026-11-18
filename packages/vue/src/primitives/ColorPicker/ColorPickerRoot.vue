<script setup lang="ts">
import { unrefElement } from '@vueuse/core'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger, useDirection } from 'reka-ui'
import { computed, shallowRef, useTemplateRef } from 'vue'

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
   * Escape during a press that changed the colour, or the picker closing during one: the colour
   * from before the press has just come back through `update`, and a listener that batches the
   * press can roll it back.
   */
  cancel: []
}>()

const swatchBg = computed(() => colorToCSS(color))
let pressColor: Color = { ...color }
const gesture = usePickerGesture({
  open: () => popupOpen.value,
  // The colour the press found when it first changed it, so a change from elsewhere since the
  // press began is not put back.
  beforeChange: () => {
    pressColor = { ...color }
  },
  commit: () => emit('commit'),
  cancel: () => {
    emit('update', pressColor)
    emit('cancel')
  }
})
const { open: popupOpen, portalActive } = useRetainedPopup(
  undefined,
  () => onOpenChange(false),
  'picker'
)

const trigger = useTemplateRef('trigger')
/**
 * Opened from inside another picker, such as a gradient stop's colour, it is placed against that
 * picker, so it sits beside it rather than over it, as Figma's does.
 */
const enclosingPicker = shallowRef<Element>()

/** A press still held when the picker closes is put back, whichever way it closes. */
function onOpenChange(open: boolean) {
  if (open)
    enclosingPicker.value = unrefElement(trigger)?.closest('[data-picker-content]') ?? undefined
  if (!open) gesture.abort()
  emit('openChange', open)
}

function update(next: Color) {
  gesture.change(() => emit('update', next))
}

const outside = pickerOutsideHandlers(() => keepOpen)
</script>

<template>
  <PopoverRoot v-model:open="popupOpen" @update:open="onOpenChange">
    <PopoverTrigger ref="trigger" as-child>
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
        :reference="enclosingPicker"
        :align="enclosingPicker ? 'start' : 'center'"
        :side="side"
        data-picker-content
        @pointer-down-outside="outside.onPointerDownOutside"
        @focus-outside="outside.onFocusOutside"
      >
        <slot :color="color" :update="update" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
