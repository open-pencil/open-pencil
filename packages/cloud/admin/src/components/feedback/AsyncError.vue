<script setup lang="ts">
import { AppButton } from '@open-pencil/ui'

const { title, description, retryLabel } = defineProps<{
  title: string
  description?: string
  retryLabel?: string
}>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div
    data-slot="async-error"
    class="rounded-lg border border-error-border bg-error-bg p-4"
    role="alert"
  >
    <p class="m-0 text-sm font-medium text-error">{{ title }}</p>
    <p v-if="description" class="mb-0 mt-1 text-xs leading-5 text-muted">{{ description }}</p>
    <AppButton
      v-if="retryLabel"
      class="mt-3"
      color="error"
      variant="outline"
      size="sm"
      @click="emit('retry')"
    >
      {{ retryLabel }}
    </AppButton>
  </div>
</template>
