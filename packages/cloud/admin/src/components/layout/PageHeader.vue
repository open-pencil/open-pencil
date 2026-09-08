<script setup lang="ts">
const { title, description } = defineProps<{ title: string; description?: string }>()
</script>

<template>
  <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 class="m-0 text-xl font-semibold text-surface">{{ title }}</h1>
      <p v-if="description" class="mb-0 mt-1 text-sm leading-6 text-muted">{{ description }}</p>
    </div>
    <slot />
  </header>
</template>
