<script setup lang="ts">
import { layerRowPartSizes, useLayerTreeGeometry } from './geometry'

const { padLeft, contentClass } = defineProps<{ padLeft: string; contentClass: string }>()
const { rowHeight } = useLayerTreeGeometry()
</script>

<template>
  <div :style="{ ...layerRowPartSizes, height: `${rowHeight}px` }">
    <span data-slot="content" :class="contentClass" :style="{ paddingInlineStart: padLeft }">
      <slot />
    </span>
    <slot name="end" />
  </div>
</template>
