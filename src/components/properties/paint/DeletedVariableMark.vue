<script setup lang="ts">
import Tip from '@/components/ui/overlay/Tip.vue'

/**
 * Stands in for a paint's swatch while the variable it follows is deleted, as Figma marks it: the
 * paint still draws the variable's value, but there is no colour of its own to pick.
 */
const { label } = defineProps<{ label: string }>()
</script>

<template>
  <Tip :label="label">
    <span
      class="flex size-4 shrink-0 items-center justify-center text-muted"
      role="img"
      :aria-label="label"
    >
      <icon-lucide-circle-question-mark class="size-4" aria-hidden="true" />
    </span>
  </Tip>
</template>
