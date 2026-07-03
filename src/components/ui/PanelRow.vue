<script setup lang="ts">
const { cols = 'auto', gap = 'md' } = defineProps<{
  cols?: 'auto' | 'two' | 'fill'
  gap?: 'sm' | 'md'
}>()
</script>

<template>
  <div
    class="flex items-center"
    :class="[
      gap === 'sm' ? 'gap-0.5' : 'gap-1.5',
      cols === 'two' ? '[&>*]:min-w-0 [&>*]:flex-1' : '',
      cols === 'fill' ? '[&>*:first-child]:min-w-0 [&>*:first-child]:flex-1' : ''
    ]"
  >
    <slot />
  </div>
</template>
