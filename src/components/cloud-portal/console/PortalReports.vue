<script setup lang="ts">
import { createColumnHelper } from '@tanstack/vue-table'
import { compact } from 'es-toolkit'
import { computed, h, ref } from 'vue'

import type { CloudAdminReportFilter } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import {
  usePortalList,
  type PortalListPage,
  type PortalListRequest,
  type PortalTableFeatures
} from '@/app/cloud-portal/list'

import PortalRowMenu from '../table/PortalRowMenu.vue'
import PortalStatusCell from '../table/PortalStatusCell.vue'
import PortalTable from '../table/PortalTable.vue'
import PortalTextCell from '../table/PortalTextCell.vue'
import type { PortalContentAction, PortalDocumentRow, PortalReportRow } from '../types'
import { contentActions, needsConfirmation } from './content'
import PortalContentConfirm from './PortalContentConfirm.vue'

/** Reports people sent about documents shared with them, open ones first. */
const { load, busy = null } = defineProps<{
  load: (
    request: PortalListRequest<CloudAdminReportFilter>
  ) => Promise<PortalListPage<CloudAdminReportFilter, PortalReportRow>>
  /** The report an action is being saved for. */
  busy?: string | null
}>()
const emit = defineEmits<{
  act: [action: PortalContentAction, report: PortalReportRow, reason?: string]
}>()

const messages = useCloudPortalMessages()
const reasons = computed(() => ({
  'spam-phishing': messages.value.reportReasonSpam,
  illegal: messages.value.reportReasonIllegal,
  copyright: messages.value.reportReasonCopyright,
  harassment: messages.value.reportReasonHarassment,
  other: messages.value.reportReasonOther
}))
const statuses = computed(() => ({
  open: { label: messages.value.reportOpen, tone: 'warning' as const },
  actioned: { label: messages.value.reportActioned, tone: 'success' as const },
  dismissed: { label: messages.value.reportDismissed, tone: 'neutral' as const }
}))

const pending = ref<{
  action: PortalContentAction
  document: PortalDocumentRow
  report: PortalReportRow
} | null>(null)
function choose(action: PortalContentAction, report: PortalReportRow) {
  if (needsConfirmation(action)) pending.value = { action, document: report.document, report }
  else emit('act', action, report)
}
function confirm(reason?: string) {
  const chosen = pending.value
  pending.value = null
  if (chosen) emit('act', chosen.action, chosen.report, reason)
}

const column = createColumnHelper<PortalTableFeatures, PortalReportRow>()
const reports = usePortalList<CloudAdminReportFilter, PortalReportRow>({
  filter: 'open',
  load: (request) => load(request),
  rowId: (report) => report.id,
  columns: column.columns([
    column.display({
      id: 'document',
      header: () => messages.value.columnDocument,
      meta: { class: 'w-1/4' },
      cell: ({ row: { original: report } }) =>
        h(PortalTextCell, {
          text: report.document.name,
          strong: true,
          badge: report.document.takenDown ? messages.value.takenDown : null,
          detail: report.document.workspace
        })
    }),
    column.display({
      id: 'report',
      header: () => messages.value.columnReport,
      cell: ({ row: { original: report } }) =>
        h(PortalTextCell, {
          text: reasons.value[report.reason],
          quote: report.description,
          detail: compact([
            report.reporter
              ? messages.value.reportedBy({ name: report.reporter })
              : messages.value.reportedByGuest,
            report.replyEmail
          ]).join(' · ')
        })
    }),
    column.accessor('reportedOn', {
      header: () => messages.value.columnReported,
      meta: { class: 'hidden w-28 whitespace-nowrap text-muted @xl/table:table-cell' }
    }),
    column.display({
      id: 'status',
      header: () => messages.value.columnStatus,
      meta: { class: 'hidden w-32 @2xl/table:table-cell' },
      cell: ({ row: { original: report } }) =>
        h(PortalStatusCell, {
          statuses: [statuses.value[report.status]],
          detail: report.share?.revoked ? messages.value.linkRevoked : null
        })
    }),
    column.display({
      id: 'actions',
      header: () => messages.value.columnActions,
      meta: { class: 'w-px whitespace-nowrap text-right', actions: true },
      cell: ({ row: { original: report } }) =>
        h(PortalRowMenu<PortalContentAction>, {
          label: messages.value.actionsFor({ name: report.document.name }),
          items: contentActions(messages.value, report.document, report),
          disabled: busy === report.id,
          onSelect: (action: PortalContentAction) => choose(action, report)
        })
    })
  ])
})
const filters = computed(() => [
  { value: 'open' as const, label: messages.value.filterOpen },
  { value: 'actioned' as const, label: messages.value.filterActioned },
  { value: 'dismissed' as const, label: messages.value.filterDismissed },
  { value: 'all' as const, label: messages.value.filterAll }
])

defineExpose({ reload: reports.reload })
</script>

<template>
  <PortalTable
    :list="reports"
    :label="messages.reports"
    :search-label="messages.searchReports"
    :filters="filters"
    :empty-label="messages.noReports"
    :empty-description="messages.noReportsDescription"
  >
    <template #icon><icon-lucide-flag class="size-5" /></template>
  </PortalTable>
  <PortalContentConfirm :pending="pending" @confirm="confirm" @cancel="pending = null" />
</template>
