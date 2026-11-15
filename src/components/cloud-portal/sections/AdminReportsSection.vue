<script setup lang="ts">
import { useTemplateRef } from 'vue'

import type { CloudAdminReportFilter } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages, useI18n } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import type { PortalListRequest } from '@/app/cloud-portal/list'
import { formatDate } from '@/app/i18n/date'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import PortalReports from '../console/PortalReports.vue'
import type { PortalContentAction, PortalReportRow } from '../types'
import { documentRow, useContentActions } from './content'

const emit = defineEmits<{ changed: [] }>()
const portal = usePortal()
const messages = useCloudPortalMessages()
const { locale } = useI18n()
const list = useTemplateRef('list')

async function load(request: PortalListRequest<CloudAdminReportFilter>) {
  const { reports, total, counts } = await portal.api.reports(request)
  const rows: PortalReportRow[] = reports.map((report) => ({
    id: report.id,
    reason: report.reason,
    description: report.description,
    status: report.status,
    reporter: report.reporter ? (report.reporter.name ?? messages.value.someoneElse) : null,
    replyEmail: report.replyEmail,
    reportedOn: formatDate(report.createdAt, 'date', locale.value),
    document: documentRow(report.document, locale.value),
    share: report.share
  }))
  return { rows, total, counts }
}

const {
  subject: busy,
  error,
  run
} = useContentActions(
  () => list.value?.reload(),
  () => emit('changed')
)
function act(action: PortalContentAction, report: PortalReportRow, reason?: string) {
  void run(
    report.id,
    action,
    { document: report.document, reportId: report.id, shareId: report.share?.id },
    reason
  )
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <AppAlert v-if="error" tone="error" :heading="messages.errorTitle" :description="error" />
    <PortalReports ref="list" :load="load" :busy="busy" @act="act" />
  </div>
</template>
