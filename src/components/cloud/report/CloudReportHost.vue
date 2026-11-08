<script setup lang="ts">
import { computed, ref } from 'vue'

import { useCloudMessages } from '@open-pencil/vue/i18n'

import { cloudReport, sendCloudReport, type CloudReportInput } from '@/app/cloud/reports/file'
import { toast } from '@/app/shell/ui'

import CloudReportDialog from './CloudReportDialog.vue'

/** The one Report dialog, for a document opened from a share link. */
const t = useCloudMessages()
const busy = ref(false)
const failure = ref<'failed' | 'too-many' | null>(null)
const open = computed({
  get: () => cloudReport.value !== null,
  set: (value) => {
    if (value) return
    cloudReport.value = null
    failure.value = null
  }
})

async function send(input: CloudReportInput) {
  const draft = cloudReport.value
  if (!draft || busy.value) return
  busy.value = true
  failure.value = null
  const outcome = await sendCloudReport(draft.link, input)
  busy.value = false
  if (outcome !== 'sent') {
    failure.value = outcome
    return
  }
  open.value = false
  toast.info(t.value.reportSent)
}
</script>

<template>
  <CloudReportDialog
    v-model:open="open"
    :host="cloudReport?.host ?? ''"
    :email="cloudReport?.email ?? null"
    :busy="busy"
    :failure="failure"
    @send="send"
    @cancel="open = false"
  />
</template>
