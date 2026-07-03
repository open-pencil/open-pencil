<script setup lang="ts">
import type { LayerDragInstruction } from '@open-pencil/vue'

const { active, instruction, level, indent } = defineProps<{
  active: boolean
  instruction: LayerDragInstruction | null
  level: number
  indent: number
}>()
</script>

<template>
  <div
    v-if="active && instruction?.type === 'make-child'"
    class="pointer-events-none absolute inset-y-1 rounded border border-accent bg-accent/10"
    :style="{
      left: `${level * indent}px`,
      right: '4px'
    }"
  />

  <div
    v-else-if="active && instruction"
    class="pointer-events-none absolute h-0.5 bg-accent"
    :class="{
      'bottom-0': instruction.type === 'reorder-below',
      'top-0': instruction.type === 'reorder-above'
    }"
    :style="{
      left: `${(level - 1) * indent}px`,
      width: `calc(100% - ${(level - 1) * indent}px)`
    }"
  />
</template>
