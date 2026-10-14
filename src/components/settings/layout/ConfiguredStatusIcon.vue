<script setup lang="ts">
/** Whether a service is set up, as System setup shows it: a green check, or a dashed circle. */
const { configured } = defineProps<{ configured: boolean }>()
</script>

<template>
  <icon-lucide-circle-check v-if="configured" class="size-4 text-success" />
  <icon-lucide-circle-dashed v-else class="size-4 text-muted" />
</template>
