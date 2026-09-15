<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed } from 'vue'

import { colorToCSS } from '@open-pencil/core/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { useRetainedPopup } from '#vue/lifecycle/retention/popup'

export interface ColorPickerUI {
  content?: string
  swatch?: string
}

const {
  color,
  label = 'Edit color',
  ui
} = defineProps<{
  color: Color
  label?: string
  ui?: ColorPickerUI
}>()

const emit = defineEmits<{
  update: [color: Color]
  openChange: [open: boolean]
  cancel: []
}>()

const swatchBg = computed(() => colorToCSS(color))
const { open: popupOpen, portalActive } = useRetainedPopup(undefined, () => {
  emit('cancel')
  emit('openChange', false)
})

function cancelFromEscape(event: KeyboardEvent) {
  event.stopPropagation()
  emit('cancel')
}
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
        side="left"
        data-picker-content
        @escape-key-down="cancelFromEscape"
      >
        <slot :color="color" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
