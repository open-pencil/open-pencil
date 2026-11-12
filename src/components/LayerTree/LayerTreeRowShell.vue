<script setup lang="ts">
import { useLayerTreeGeometry } from './geometry'

const { padLeft } = defineProps<{ padLeft: string }>()
const { rowHeight } = useLayerTreeGeometry()
</script>

<template>
  <div :style="{ height: `${rowHeight}px`, paddingInlineStart: padLeft }">
    <slot />
  </div>
</template>
