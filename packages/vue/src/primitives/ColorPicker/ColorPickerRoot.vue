<script setup lang="ts">
import { computed } from 'vue'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { colorToCSS } from '@open-pencil/core/color'

import type { Color } from '@open-pencil/core/types'

const { color, contentClass, swatchClass } = defineProps<{
  color: Color
  contentClass?: string
  swatchClass?: string
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
          :class="swatchClass"
          :style="{ background: swatchBg }"
        />
      </slot>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        data-test-id="color-picker-popover"
        :class="contentClass"
        :side-offset="4"
        side="left"
      >
        <slot :color="color" :update="(nextColor: Color) => emit('update', nextColor)" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
