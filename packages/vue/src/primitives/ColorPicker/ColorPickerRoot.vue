<script setup lang="ts">
import { computed } from 'vue'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { colorToCSS } from '@open-pencil/core/color'

import type { Color } from '@open-pencil/core/types'

export interface ColorPickerUi {
  content?: string
  swatch?: string
}

const { color, ui } = defineProps<{
  color: Color
  ui?: ColorPickerUi
}>()

const emit = defineEmits<{ update: [color: Color] }>()

const swatchBg = computed(() => colorToCSS(color))
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <slot name="trigger" :style="{ background: swatchBg }">
        <button
          data-test-id="color-picker-swatch"
          :class="ui?.swatch"
          :style="{ background: swatchBg }"
        />
      </slot>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        data-test-id="color-picker-popover"
        :class="ui?.content"
        :side-offset="4"
        side="left"
      >
        <slot :color="color" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
