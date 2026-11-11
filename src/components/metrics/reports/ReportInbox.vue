<script setup lang="ts">
import { createColumnHelper } from '@tanstack/vue-table'
import { h, watch } from 'vue'

import type { InboxReport, ReportStatus } from '@open-pencil/feedback/contract'

import { usePortalList, type PortalTableFeatures } from '@/app/cloud-portal/list'
import { formatTime } from '@/app/metrics/format'
import { reportInboxPage, type ReportInboxFilter } from '@/app/metrics/reports'
import PortalRowMenu from '@/components/cloud-portal/table/PortalRowMenu.vue'
import PortalStatusCell from '@/components/cloud-portal/table/PortalStatusCell.vue'
import PortalTable from '@/components/cloud-portal/table/PortalTable.vue'
import PortalTextCell from '@/components/cloud-portal/table/PortalTextCell.vue'

import { REPORT_STATUS_LABELS, replyLink, reportBuild, type ReportAction } from './labels'

/**
 * The reports people sent in the range, open ones first shown, in the Cloud console's table:
 * what they wrote, who to write back to, their build, and where the team stands with each.
 */
const { reports, busy = null } = defineProps<{
  reports: InboxReport[]
  /** The report whose triage is being saved. */
  busy?: string | null
}>()
const emit = defineEmits<{
  open: [report: InboxReport]
  triage: [report: InboxReport, status: ReportStatus]
}>()

function actions(report: InboxReport) {
  const items: { action: ReportAction; label: string; separated?: boolean }[] = [
    { action: 'open', label: 'Open report' }
  ]
  if (report.email) items.push({ action: 'reply', label: 'Reply by email' })
  if (report.status !== 'replied')
    items.push({ action: 'replied', label: 'Mark as replied', separated: true })
  if (report.status !== 'closed') items.push({ action: 'closed', label: 'Close' })
  if (report.status !== 'open') items.push({ action: 'open-again', label: 'Reopen' })
  return items
}

function select(action: ReportAction, report: InboxReport) {
  if (action === 'open') emit('open', report)
  else if (action === 'reply' && report.email) globalThis.location.assign(replyLink(report))
  else if (action === 'open-again') emit('triage', report, 'open')
  else if (action === 'replied' || action === 'closed') emit('triage', report, action)
}

const column = createColumnHelper<PortalTableFeatures, InboxReport>()
const list = usePortalList<ReportInboxFilter, InboxReport>({
  filter: 'open',
  load: async (request) => reportInboxPage(reports, request),
  rowId: (report) => report.id,
  columns: column.columns([
    column.display({
      id: 'report',
      header: () => 'Report',
      cell: ({ row: { original: report } }) =>
        h(PortalTextCell, {
          text: report.kind === 'error' ? 'Error' : 'Problem',
          strong: true,
          quote: report.note,
          detail: report.error
        })
    }),
    column.display({
      id: 'from',
      header: () => 'From',
      meta: { class: 'hidden w-1/5 @xl/table:table-cell' },
      cell: ({ row: { original: report } }) =>
        h(PortalTextCell, { text: report.email ?? 'No address', detail: reportBuild(report) })
    }),
    column.display({
      id: 'received',
      header: () => 'Received',
      meta: { class: 'hidden w-32 whitespace-nowrap text-muted @2xl/table:table-cell' },
      cell: ({ row: { original: report } }) => formatTime(report.receivedAt)
    }),
    column.display({
      id: 'status',
      header: () => 'Status',
      meta: { class: 'w-28' },
      cell: ({ row: { original: report } }) =>
        h(PortalStatusCell, {
          statuses: [REPORT_STATUS_LABELS[report.status]],
          detail: report.files.length ? 'Has files' : null
        })
    }),
    column.display({
      id: 'actions',
      header: () => 'Actions',
      meta: { class: 'w-px whitespace-nowrap text-right', actions: true },
      cell: ({ row: { original: report } }) =>
        h(PortalRowMenu<ReportAction>, {
          label: `Actions for report ${report.id.slice(0, 8)}`,
          items: actions(report),
          disabled: busy === report.id,
          onSelect: (action: ReportAction) => select(action, report)
        })
    })
  ])
})

// The page holds the range's reports; the table pages through them again when they change.
watch(
  () => reports,
  () => list.reload()
)

const filters: { value: ReportInboxFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'replied', label: 'Replied' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All' }
]
</script>

<template>
  <PortalTable
    :list="list"
    label="Reports"
    search-label="Search reports"
    :filters="filters"
    empty-label="No reports"
    empty-description="Problem reports, and error reports with a note or an address, show here."
  >
    <template #icon><icon-lucide-inbox class="size-5" /></template>
  </PortalTable>
</template>
