<script setup lang="ts">
import { LAYER_TREE_ROW_HEIGHT } from './geometry'

const { padLeft } = defineProps<{ padLeft: string }>()
</script>

<template>
  <div :style="{ height: `${LAYER_TREE_ROW_HEIGHT}px`, paddingLeft: padLeft }">
    <slot />
  </div>
</template>
