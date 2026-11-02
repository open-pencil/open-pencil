<script setup lang="ts">
import { useId } from 'vue'

const headingId = useId()
</script>

<template>
  <section class="flex flex-col gap-3" :aria-labelledby="headingId">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0 flex-1">
        <h3 :id="headingId" class="text-xs font-semibold text-surface"><slot name="title" /></h3>
        <p v-if="$slots.description" class="mt-1 text-2xs text-muted">
          <slot name="description" />
        </p>
      </div>
      <div v-if="$slots.actions" class="shrink-0"><slot name="actions" /></div>
    </div>
    <slot />
  </section>
</template>
