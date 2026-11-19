<script setup lang="ts">
import type { DocumentReportReason } from '#cloud/contract'

import type { DocumentReportPayload } from '../schema'
import BrandEmail from './BrandEmail.vue'
import EmailText from './EmailText.vue'
import { useEmailLocalization } from './localization'

/** To administrators: someone reported a shared document, in their own words. */
const { payload } = defineProps<{ payload: DocumentReportPayload }>()

const { t } = useEmailLocalization()
const reasons: Record<DocumentReportReason, string> = {
  'spam-phishing': t.reportReasonSpamPhishing,
  illegal: t.reportReasonIllegal,
  copyright: t.reportReasonCopyright,
  harassment: t.reportReasonHarassment,
  other: t.reportReasonOther
}
const report = { document: payload.documentName, reason: reasons[payload.reason] }
</script>

<template>
  <BrandEmail
    :preview="t.documentReportPreview(report)"
    :heading="t.documentReportHeading"
    :action="{ label: t.documentReportAction, url: payload.actionURL }"
  >
    <EmailText>{{ t.documentReport(report) }}</EmailText>
    <EmailText>{{ payload.description }}</EmailText>
  </BrandEmail>
</template>
