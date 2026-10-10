<script setup lang="ts">
import PortalPublicLayout from '../layout/PortalPublicLayout.vue'

/** A Cloud page that tells the person where they stand and what to do next. */
const {
  host,
  heading,
  description,
  tone = 'neutral'
} = defineProps<{
  host: string
  heading: string
  description: string
  tone?: 'neutral' | 'success' | 'waiting'
}>()
</script>

<template>
  <PortalPublicLayout :host="host" :heading="heading" :description="description">
    <template #icon>
      <span
        class="flex size-10 items-center justify-center rounded-full bg-panel-field text-muted data-[tone=success]:bg-success/10 data-[tone=success]:text-success"
        :data-tone="tone"
      >
        <slot name="icon" />
      </span>
    </template>
    <slot />
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </PortalPublicLayout>
</template>
