<script setup lang="ts">
import { createColumnHelper } from '@tanstack/vue-table'
import { computed, h } from 'vue'

import type { CloudAdminAuditFilter } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import {
  usePortalList,
  type PortalListPage,
  type PortalListRequest,
  type PortalTableFeatures
} from '@/app/cloud-portal/list'

import PortalIdentityCell from '../table/PortalIdentityCell.vue'
import PortalTable from '../table/PortalTable.vue'
import PortalTextCell from '../table/PortalTextCell.vue'
import type { PortalActivityEntry } from '../types'

/** What administrators did on the server, newest first. */
const { load } = defineProps<{
  load: (
    request: PortalListRequest<CloudAdminAuditFilter>
  ) => Promise<PortalListPage<CloudAdminAuditFilter, PortalActivityEntry>>
}>()

const messages = useCloudPortalMessages()
const actions = computed<Record<string, string>>(() => ({
  'enrollment.approved': messages.value.activityApproved,
  'enrollment.rejected': messages.value.activityRejected,
  'enrollment.revoked': messages.value.activityRevoked,
  'user.banned': messages.value.activitySuspended,
  'user.unbanned': messages.value.activityRestored,
  'user.sessions-revoked': messages.value.activitySignedOut,
  'user.admin-granted': messages.value.activityMadeAdmin,
  'user.admin-revoked': messages.value.activityRemovedAdmin,
  'email.regenerated': messages.value.activityEmailRetried,
  'user.two-step-reset': messages.value.activityTwoStepReset,
  'user.picture-removed': messages.value.activityPictureRemoved
}))

const column = createColumnHelper<PortalTableFeatures, PortalActivityEntry>()
const activity = usePortalList<CloudAdminAuditFilter, PortalActivityEntry>({
  filter: 'all',
  load: (request) => load(request),
  rowId: (entry) => entry.id,
  columns: column.columns([
    column.display({
      id: 'administrator',
      header: () => messages.value.columnAdministrator,
      meta: { class: 'w-1/4' },
      cell: ({ row: { original: entry } }) =>
        h(PortalIdentityCell, { id: entry.actor.id, name: entry.actor.name, size: 'sm' })
    }),
    column.display({
      id: 'action',
      header: () => messages.value.columnAction,
      // What it was about has its own column once the table is wide enough.
      cell: ({ row: { original: entry } }) =>
        h(PortalTextCell, {
          text: actions.value[entry.action] ?? messages.value.activityChanged,
          narrowDetail: entry.target,
          detail: entry.reason ? messages.value.activityReason({ reason: entry.reason }) : null
        })
    }),
    column.accessor('target', {
      header: () => messages.value.columnSubject,
      meta: { class: 'hidden w-1/4 @xl/table:table-cell' }
    }),
    column.accessor('when', {
      header: () => messages.value.columnWhen,
      meta: { class: 'hidden w-44 whitespace-nowrap text-muted @2xl/table:table-cell' }
    })
  ])
})
const filters = computed(() => [
  { value: 'all' as const, label: messages.value.filterAll },
  { value: 'accounts' as const, label: messages.value.filterAccounts },
  { value: 'requests' as const, label: messages.value.filterRequests },
  { value: 'email' as const, label: messages.value.filterEmail }
])
</script>

<template>
  <PortalTable
    :list="activity"
    :label="messages.activity"
    :search-label="messages.searchActivity"
    :filters="filters"
    :empty-label="messages.noActivityFound"
    :empty-description="messages.noActivityFoundDescription"
  >
    <template #icon><icon-lucide-history class="size-5" /></template>
  </PortalTable>
</template>
