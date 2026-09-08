<script setup lang="ts">
const { label } = defineProps<{ label: string }>()
</script>

<template>
  <div
    data-slot="loading-state"
    class="flex items-center justify-center gap-2 p-8 text-sm text-muted"
    role="status"
  >
    <span
      class="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
      aria-hidden="true"
    />
    {{ label }}
  </div>
</template>
