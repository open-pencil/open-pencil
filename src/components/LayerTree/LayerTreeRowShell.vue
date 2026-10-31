<script setup lang="ts">
import { layerTreeGeometry } from './geometry'

const { padLeft } = defineProps<{ padLeft: string }>()
const { rowHeight } = layerTreeGeometry()
</script>

<template>
  <div :style="{ height: `${rowHeight}px`, paddingLeft: padLeft }">
    <slot />
  </div>
</template>
