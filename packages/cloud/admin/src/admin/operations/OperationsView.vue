<script setup lang="ts">
import { computed } from 'vue'

import AsyncBoundary from '#admin/components/feedback/AsyncBoundary.vue'
import PageHeader from '#admin/components/layout/PageHeader.vue'
import { useCloudI18n } from '#admin/i18n/use'
import { useOperationsAdmin } from './useOperationsAdmin'

const messages = useCloudI18n()
const operations = useOperationsAdmin()
const summary = computed(() => {
  const state = operations.data.value
  if (!state) return []
  return [
    [messages.admin.value.deployment, state.deployment],
    [messages.admin.value.enrollmentMode, state.enrollmentMode],
    [messages.admin.value.emailTransport, state.emailTransport],
    [messages.admin.value.pendingEnrollment, state.pendingEnrollment],
    [messages.admin.value.pendingEmail, state.pendingEmail],
    [messages.admin.value.failedEmail, state.failedEmail]
  ] as const
})
</script>

<template>
  <section>
    <PageHeader :title="messages.admin.value.operations" />
    <AsyncBoundary
      :pending="operations.isPending.value"
      :error="operations.isError.value"
      :loading-label="messages.common.value.loading"
      :error-label="messages.errors.value.network"
      :retry-label="messages.common.value.retry"
      @retry="operations.refetch()"
    >
      <dl v-if="operations.data.value" class="grid gap-3 sm:grid-cols-3">
        <div
          v-for="[label, value] in summary"
          :key="label"
          class="rounded-lg border border-border bg-panel p-4"
        >
          <dt class="text-xs text-muted">{{ label }}</dt>
          <dd class="m-0 mt-2 text-xl font-medium tabular-nums">{{ value }}</dd>
        </div>
      </dl>
    </AsyncBoundary>
  </section>
</template>
