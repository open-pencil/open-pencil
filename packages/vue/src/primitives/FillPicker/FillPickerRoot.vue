<script setup lang="ts">
import { computed } from 'vue'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'

import { useFillPicker } from '#vue/primitives/FillPicker/useFillPicker'

import type { Fill } from '@open-pencil/core/scene-graph'

const { fill, contentClass, swatchClass } = defineProps<{
  fill: Fill
  contentClass?: string
  swatchClass?: string
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
        <button :class="swatchClass" :style="{ background: swatchBg }" />
      </slot>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent :class="contentClass" :side-offset="4" side="left">
        <slot
          :fill="fill"
          :category="category"
          :to-solid="toSolid"
          :to-gradient="toGradient"
          :to-image="toImage"
          :update="(nextFill: Fill) => emit('update', nextFill)"
        />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
