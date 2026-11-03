<script setup lang="ts">
import { useReportDialog } from '@/app/reports/dialog'
import { reportDialogOpen } from '@/app/reports/state'

import ReportDialog from './ReportDialog.vue'

/** The report dialog, driven by the report the app has open. */
const {
  kind,
  note,
  email,
  emailInvalid,
  includeActivity,
  attachDocument,
  hasDocument,
  preparingDocument,
  documentFailed,
  report,
  preview,
  sending,
  failure,
  send
} = useReportDialog()
</script>

<template>
  <ReportDialog
    v-model:open="reportDialogOpen"
    v-model:note="note"
    v-model:email="email"
    v-model:include-activity="includeActivity"
    v-model:attach-document="attachDocument"
    :kind="kind"
    :email-invalid="emailInvalid"
    :has-document="hasDocument"
    :preparing-document="preparingDocument"
    :document-failed="documentFailed"
    :preview="preview"
    :can-send="report !== null"
    :sending="sending"
    :failure="failure"
    @send="send"
  />
</template>
