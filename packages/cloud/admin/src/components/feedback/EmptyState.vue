<script setup lang="ts">
const { label } = defineProps<{ label: string }>()
</script>

<template>
  <div data-slot="empty-state" class="p-8 text-center text-sm text-muted">{{ label }}</div>
</template>
