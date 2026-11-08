<script setup lang="ts">
import { computed, ref, watch } from 'vue'

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
// A report starts clean as its dialog opens; the closing one keeps its alert.
watch(cloudReport, (draft, previous) => {
  if (draft && draft !== previous) failure.value = null
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
    :email="shown?.email ?? null"
    :busy="busy"
    :failure="failure"
    @send="send"
    @cancel="open = false"
  />
</template>
