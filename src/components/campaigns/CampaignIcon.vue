<script setup lang="ts">
/** A campaign's icon by its kind: a heart for a donation ask, a cloud for Cloud, else neutral. */
const { kind } = defineProps<{ kind?: string }>()
</script>

<template>
  <icon-lucide-heart v-if="kind === 'donation'" data-kind="donation" aria-hidden="true" />
  <icon-lucide-cloud v-else-if="kind === 'cloud'" data-kind="cloud" aria-hidden="true" />
  <icon-lucide-sparkles v-else aria-hidden="true" />
</template>
