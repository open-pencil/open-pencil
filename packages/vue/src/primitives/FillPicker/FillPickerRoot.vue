<script setup lang="ts">
import { computed } from 'vue'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'

import { useFillPicker } from '#vue/primitives/FillPicker/useFillPicker'

import type { Fill } from '@open-pencil/scene-graph'

export interface FillPickerUI {
  content?: string
  swatch?: string
}

const { fill, ui } = defineProps<{
  fill: Fill
  ui?: FillPickerUI
}>()

const emit = defineEmits<{ update: [fill: Fill] }>()

const { category, swatchBg, toSolid, toGradient, toImage } = useFillPicker(
  computed(() => fill),
  (updated) => emit('update', updated)
)
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <slot name="trigger" :style="{ background: swatchBg }">
        <button :class="ui?.swatch" :style="{ background: swatchBg }" />
      </slot>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent :class="ui?.content" :side-offset="4" side="left">
        <slot
          :fill="fill"
          :category="category"
          :to-solid="toSolid"
          :to-gradient="toGradient"
          :to-image="toImage"
        />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
