<script setup lang="ts">
import AsyncBoundary from '#admin/components/feedback/AsyncBoundary.vue'
import EmptyState from '#admin/components/feedback/EmptyState.vue'
import PageHeader from '#admin/components/layout/PageHeader.vue'
import { useCloudI18n } from '#admin/i18n/use'
import { useAuditAdmin } from './useAuditAdmin'

const messages = useCloudI18n()
const events = useAuditAdmin()
</script>

<template>
  <section>
    <PageHeader :title="messages.admin.value.audit" />
    <AsyncBoundary
      :pending="events.isPending.value"
      :error="events.isError.value"
      :loading-label="messages.common.value.loading"
      :error-label="messages.errors.value.network"
      :retry-label="messages.common.value.retry"
      @retry="events.refetch()"
    >
      <EmptyState
        v-if="!events.data.value?.events.length"
        :label="messages.admin.value.noAuditEvents"
      />
      <div v-else class="rounded-lg border border-border bg-panel">
        <article
          v-for="event in events.data.value.events"
          :key="event.id"
          class="border-b border-border p-3 text-xs last:border-b-0"
        >
          <strong>{{ event.action }}</strong>
          <span class="ml-2 text-muted"
            >{{ event.subjectType }} {{ event.subjectId }} ·
            {{
              new Intl.DateTimeFormat(messages.locale.value, {
                dateStyle: 'medium',
                timeStyle: 'short'
              }).format(new Date(event.createdAt))
            }}</span
          >
        </article>
      </div>
    </AsyncBoundary>
  </section>
</template>
