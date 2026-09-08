<script setup lang="ts">
import AsyncBoundary from '#admin/components/feedback/AsyncBoundary.vue'
import EmptyState from '#admin/components/feedback/EmptyState.vue'
import PageHeader from '#admin/components/layout/PageHeader.vue'
import { useCloudI18n } from '#admin/i18n/use'
import EmailMessageRow from './EmailMessageRow.vue'
import { useEmailAdmin } from './useEmailAdmin'

const i18n = useCloudI18n()
const admin = useEmailAdmin()
</script>

<template>
  <section>
    <PageHeader :title="i18n.admin.value.email" :description="i18n.admin.value.emailDescription" />
    <AsyncBoundary
      :pending="admin.messages.isPending.value"
      :error="admin.messages.isError.value"
      :loading-label="i18n.common.value.loading"
      :error-label="i18n.errors.value.network"
      :retry-label="i18n.common.value.retry"
      @retry="admin.messages.refetch()"
    >
      <EmptyState
        v-if="!admin.messages.data.value?.messages.length"
        :label="i18n.admin.value.noEmailMessages"
      />
      <div v-else class="grid gap-2">
        <EmailMessageRow
          v-for="message in admin.messages.data.value.messages"
          :key="message.id"
          :message="message"
          :busy="
            admin.regenerate.isPending.value && admin.regenerate.variables.value === message.id
          "
          :regenerate-label="i18n.admin.value.regenerate"
          :attempts-label="i18n.common.value.attempts({ count: message.attemptCount })"
          :no-error-label="i18n.common.value.noError"
          @regenerate="admin.regenerate.mutate(message.id)"
        />
      </div>
    </AsyncBoundary>
  </section>
</template>
