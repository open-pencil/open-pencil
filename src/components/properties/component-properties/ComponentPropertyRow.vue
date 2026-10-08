<script setup lang="ts">
/** One instance property: its name on the left, its value control on the right. */
const { name } = defineProps<{ name: string }>()
</script>

<template>
  <div class="grid min-h-7 grid-cols-[minmax(0,5.5rem)_minmax(0,1fr)] items-center gap-2">
    <span class="truncate text-xs text-muted">{{ name }}</span>
    <slot />
  </div>
</template>
