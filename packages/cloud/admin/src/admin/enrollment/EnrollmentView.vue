<script setup lang="ts">
import { AppButton } from '@open-pencil/ui'
import type { Enrollment } from '@open-pencil/cloud/contract'
import { computed, ref } from 'vue'

import AsyncBoundary from '#admin/components/feedback/AsyncBoundary.vue'
import EmptyState from '#admin/components/feedback/EmptyState.vue'
import PageHeader from '#admin/components/layout/PageHeader.vue'
import ConfirmDialog from '#admin/components/dialog/ConfirmDialog.vue'
import { useCloudI18n } from '#admin/i18n/use'
import { useEnrollmentAdmin } from './useEnrollmentAdmin'

const messages = useCloudI18n()
const status = ref('')
const selected = ref<{ record: Enrollment; action: 'reject' | 'revoke' } | null>(null)
const confirmationOpen = computed({
  get: () => selected.value !== null,
  set: (open: boolean) => {
    if (!open) selected.value = null
  }
})
const { records, review } = useEnrollmentAdmin(status)

function approve(record: Enrollment): void {
  review.mutate({ id: record.id, action: 'approve' })
}
function confirmReview(note: string | undefined): void {
  if (!selected.value) return
  review.mutate(
    { id: selected.value.record.id, action: selected.value.action, note },
    { onSuccess: () => (selected.value = null) }
  )
}
</script>

<template>
  <section>
    <PageHeader
      :title="messages.admin.value.enrollment"
      :description="messages.admin.value.enrollmentDescription"
    >
      <select
        v-model="status"
        :aria-label="messages.admin.value.filterEnrollment"
        class="h-8 rounded-md border border-border bg-input px-3 text-xs text-surface outline-none hover:border-muted/60 focus:border-panel-focus focus:ring-1 focus:ring-accent/25"
      >
        <option value="">{{ messages.admin.value.allStatuses }}</option>
        <option value="pending">{{ messages.admin.value.statusPending }}</option>
        <option value="approved">{{ messages.admin.value.statusApproved }}</option>
        <option value="rejected">{{ messages.admin.value.statusRejected }}</option>
        <option value="revoked">{{ messages.admin.value.statusRevoked }}</option>
      </select>
    </PageHeader>
    <AsyncBoundary
      :pending="records.isPending.value"
      :error="records.isError.value"
      :loading-label="messages.common.value.loading"
      :error-label="messages.errors.value.network"
      :retry-label="messages.common.value.retry"
      @retry="records.refetch()"
    >
      <div class="overflow-x-auto rounded-lg border border-border bg-panel">
        <EmptyState
          v-if="!records.data.value?.enrollments.length"
          :label="messages.admin.value.noEnrollments"
        />
        <table v-else class="w-full min-w-[700px] text-left text-xs">
          <thead class="bg-panel-secondary text-muted">
            <tr>
              <th class="p-3 font-medium">{{ messages.admin.value.email }}</th>
              <th class="font-medium">{{ messages.common.value.status }}</th>
              <th class="font-medium">{{ messages.admin.value.requested }}</th>
              <th class="font-medium">{{ messages.admin.value.reason }}</th>
              <th class="pr-3 text-right font-medium">{{ messages.common.value.actions }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="record in records.data.value.enrollments"
              :key="record.id"
              class="border-t border-border hover:bg-hover/40"
            >
              <td class="p-3">
                <div>{{ record.email }}</div>
                <div class="text-muted">{{ record.name }}</div>
              </td>
              <td>{{ record.status }}</td>
              <td>
                {{
                  new Intl.DateTimeFormat(messages.locale.value, {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  }).format(new Date(record.requestedAt))
                }}
              </td>
              <td class="max-w-64 truncate text-muted">{{ record.reason }}</td>
              <td class="pr-3 text-right">
                <div class="flex justify-end gap-1">
                  <AppButton
                    v-if="record.status !== 'approved'"
                    color="primary"
                    variant="solid"
                    size="xs"
                    :loading="review.isPending.value && review.variables.value?.id === record.id"
                    @click="approve(record)"
                    >{{ messages.admin.value.approve }}</AppButton
                  >
                  <AppButton
                    v-if="record.status === 'pending'"
                    variant="ghost"
                    size="xs"
                    @click="selected = { record, action: 'reject' }"
                    >{{ messages.admin.value.reject }}</AppButton
                  >
                  <AppButton
                    v-if="record.status === 'approved'"
                    color="error"
                    variant="soft"
                    size="xs"
                    @click="selected = { record, action: 'revoke' }"
                    >{{ messages.admin.value.revoke }}</AppButton
                  >
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </AsyncBoundary>
    <ConfirmDialog
      v-model:open="confirmationOpen"
      :title="
        selected?.action === 'revoke'
          ? messages.admin.value.revokeTitle
          : messages.admin.value.rejectTitle
      "
      :description="selected?.record.email ?? ''"
      :confirm-label="
        selected?.action === 'revoke' ? messages.admin.value.revoke : messages.admin.value.reject
      "
      :cancel-label="messages.common.value.cancel"
      :reason-label="messages.admin.value.confirmationReason"
      :loading="review.isPending.value"
      require-reason
      @confirm="confirmReview"
    />
  </section>
</template>
