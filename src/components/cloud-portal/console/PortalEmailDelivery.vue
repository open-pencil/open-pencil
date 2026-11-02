<script setup lang="ts">
import { createColumnHelper } from '@tanstack/vue-table'
import { computed, h } from 'vue'

import type { CloudAdminEmailFilter } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import {
  usePortalList,
  type PortalListPage,
  type PortalListRequest,
  type PortalTableFeatures
} from '@/app/cloud-portal/list'
import AppButton from '@/components/ui/button/AppButton.vue'

import PortalStatusCell from '../table/PortalStatusCell.vue'
import PortalTable from '../table/PortalTable.vue'
import PortalTextCell from '../table/PortalTextCell.vue'
import type { PortalEmail } from '../types'

/** Email the server sends, such as invitations and sign-in links, and whether it went out. */
const { load, busy = null } = defineProps<{
  load: (
    request: PortalListRequest<CloudAdminEmailFilter>
  ) => Promise<PortalListPage<CloudAdminEmailFilter, PortalEmail>>
  /** The message being sent again. */
  busy?: string | null
}>()
const emit = defineEmits<{ retry: [id: string] }>()

const messages = useCloudPortalMessages()
const tones = {
  sent: 'success',
  waiting: 'neutral',
  failed: 'error',
  suppressed: 'neutral'
} as const
const statusLabels = computed(() => ({
  sent: messages.value.emailSent,
  waiting: messages.value.emailWaiting,
  failed: messages.value.emailFailed,
  suppressed: messages.value.emailSuppressed
}))
const kindLabels = computed<Record<string, string>>(() => ({
  'document-invitation': messages.value.emailKindInvitation,
  'workspace-invitation': messages.value.emailKindWorkspaceInvitation,
  'enrollment-requested': messages.value.emailKindEnrollmentRequested,
  'admin-enrollment-notification': messages.value.emailKindAdminNotification,
  'enrollment-approved': messages.value.emailKindEnrollmentApproved,
  'enrollment-rejected': messages.value.emailKindEnrollmentRejected,
  'enrollment-revoked': messages.value.emailKindEnrollmentRevoked,
  'email-verification': messages.value.emailKindVerification,
  'password-reset': messages.value.emailKindPasswordReset,
  'password-changed': messages.value.emailKindPasswordChanged,
  'email-change-requested': messages.value.emailKindEmailChangeRequested,
  'new-sign-in': messages.value.emailKindNewSignIn,
  'two-step-changed': messages.value.emailKindTwoStepChanged
}))
/** What went wrong, or how many tries it took. */
function delivery(email: PortalEmail) {
  if (email.error) return email.error
  return email.attempts > 1 ? messages.value.attempts(email.attempts) : null
}

const column = createColumnHelper<PortalTableFeatures, PortalEmail>()
const emails = usePortalList<CloudAdminEmailFilter, PortalEmail>({
  filter: 'all',
  load: (request) => load(request),
  rowId: (email) => email.id,
  columns: column.columns([
    column.display({
      id: 'message',
      header: () => messages.value.columnMessage,
      // The recipient has its own column once the table is wide enough.
      cell: ({ row: { original: email } }) =>
        h(PortalTextCell, {
          text: kindLabels.value[email.kind] ?? messages.value.emailKindOther,
          strong: true,
          narrowDetail: email.recipient
        })
    }),
    column.accessor('recipient', {
      header: () => messages.value.columnRecipient,
      meta: { class: 'hidden text-muted @xl/table:table-cell' }
    }),
    column.display({
      id: 'status',
      header: () => messages.value.columnStatus,
      meta: { class: 'w-32' },
      cell: ({ row: { original: email } }) =>
        h(PortalStatusCell, {
          statuses: [{ label: statusLabels.value[email.status], tone: tones[email.status] }],
          detail: delivery(email)
        })
    }),
    column.accessor('when', {
      header: () => messages.value.columnWhen,
      meta: { class: 'hidden w-44 whitespace-nowrap text-muted @2xl/table:table-cell' }
    }),
    column.display({
      id: 'actions',
      header: () => messages.value.columnActions,
      meta: { class: 'w-px text-right', actions: true },
      cell: ({ row: { original: email } }) =>
        email.status === 'failed'
          ? h(
              AppButton,
              {
                size: 'sm',
                variant: 'outline',
                loading: busy === email.id,
                onClick: () => emit('retry', email.id)
              },
              () => messages.value.retry
            )
          : null
    })
  ])
})
const filters = computed(() => [
  { value: 'all' as const, label: messages.value.filterAll },
  { value: 'sent' as const, label: messages.value.emailSent },
  { value: 'waiting' as const, label: messages.value.emailWaiting },
  { value: 'failed' as const, label: messages.value.emailFailed }
])

defineExpose({ reload: emails.reload })
</script>

<template>
  <PortalTable
    :list="emails"
    :label="messages.emailDelivery"
    :search-label="messages.searchEmail"
    :filters="filters"
    :empty-label="messages.noEmailFound"
    :empty-description="messages.noEmailFoundDescription"
  >
    <template #icon><icon-lucide-mail class="size-5" /></template>
  </PortalTable>
</template>
