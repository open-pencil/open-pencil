<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { DocumentReportReason } from '@open-pencil/cloud/contract'
import { useCloudMessages } from '@open-pencil/vue/i18n'

import { cloudReport, sendCloudReport, type CloudReportInput } from '@/app/cloud/reports/file'
import { toast } from '@/app/shell/ui'
import { useHeldContent } from '@/components/ui/overlay/held'

import CloudReportDialog from './CloudReportDialog.vue'

/** The one Report dialog, for a document opened from a share link. */
const t = useCloudMessages()
const busy = ref(false)
const failure = ref<'failed' | 'too-many' | null>(null)
// Drawn from what it showed while it animates closed.
const shown = useHeldContent(cloudReport)
const open = computed({
  get: () => cloudReport.value !== null,
  set: (value) => {
    if (!value) cloudReport.value = null
  }
})
const reason = ref<DocumentReportReason>('spam-phishing')
const description = ref('')
const replyEmail = ref('')
// A report starts clean as its dialog opens, offering the signed-in address for a reply; the
// closing one keeps what it showed.
watch(cloudReport, (draft, previous) => {
  if (!draft || draft === previous) return
  failure.value = null
  reason.value = 'spam-phishing'
  description.value = ''
  replyEmail.value = draft.email ?? ''
})

async function send(input: CloudReportInput) {
  const draft = cloudReport.value
  if (!draft || busy.value) return
  busy.value = true
  failure.value = null
  const outcome = await sendCloudReport(draft.link, input)
  busy.value = false
  // Sent counts whatever the dialog does now; the rest only concerns the dialog that sent it.
  if (outcome === 'sent') toast.info(t.value.reportSent)
  if (cloudReport.value !== draft) return
  if (outcome === 'sent') open.value = false
  else failure.value = outcome
}
</script>

<template>
  <CloudReportDialog
    v-model:open="open"
    :host="shown?.host ?? ''"
    v-model:reason="reason"
    v-model:description="description"
    v-model:reply-email="replyEmail"
    :busy="busy"
    :failure="failure"
    @send="send"
  />
</template>
