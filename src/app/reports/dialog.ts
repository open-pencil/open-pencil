import * as v from 'valibot'
import { computed, ref, shallowRef, watch } from 'vue'

import { exportFigFile } from '@open-pencil/core/io/formats/fig'
import { diagnosticsMessages } from '@open-pencil/vue/i18n'

import { diagnostics, type DiagnosticEvent } from '@/app/diagnostics'
import { getActiveEditorStoreOrNull } from '@/app/editor/active-store'
import { appPreferences } from '@/app/settings/preferences/store'
import { toast } from '@/app/shell/ui'
import { showsDocument } from '@/app/tabs'
import { currentBuild } from '@/app/telemetry/build'
import { sharingState } from '@/app/telemetry/state'

import { buildReport, type ReportAttachment, type ReportContext } from './build'
import { sendReport, type ReportSendFailure } from './send'
import { reportDialogError, reportDialogOpen } from './state'

async function reportContext(): Promise<ReportContext> {
  const shared = appPreferences.value.sharing.usageStats === 'granted'
  return { build: await currentBuild(), installId: shared ? sharingState.value.installId : null }
}

/** The open document as a `.fig` file under the name reports accept, never its own name. */
async function documentAttachment(): Promise<ReportAttachment | null> {
  const store = showsDocument() ? getActiveEditorStoreOrNull() : null
  if (!store) return null
  const bytes = await exportFigFile(store.graph, {
    pageId: store.state.currentPageId,
    documentName: 'document'
  })
  return { name: 'document.fig', bytes }
}

/**
 * The report dialog's draft, the exact report it would send, and sending it. Fields reset as the
 * dialog opens; the recent activity is read then too, so the preview does not change under the
 * person while they read it.
 */
export function useReportDialog() {
  const note = ref('')
  const email = ref('')
  const includeActivity = ref(true)
  const attachDocument = ref(false)
  const hasDocument = ref(false)
  const sending = ref(false)
  const failure = ref<ReportSendFailure | null>(null)
  const context = shallowRef<ReportContext | null>(null)
  const activity = shallowRef<DiagnosticEvent[]>([])
  const attachment = shallowRef<ReportAttachment | null>(null)
  const preparingDocument = ref(false)

  watch(
    reportDialogOpen,
    async (open) => {
      if (!open) return
      note.value = ''
      email.value = ''
      includeActivity.value = true
      attachDocument.value = false
      attachment.value = null
      failure.value = null
      // Home and a New file tab hold no document, as the File menu decides.
      hasDocument.value = showsDocument() && getActiveEditorStoreOrNull() !== null
      activity.value = diagnostics.recent()
      context.value = await reportContext()
    },
    { immediate: true }
  )

  watch(attachDocument, async (attach) => {
    attachment.value = null
    if (!attach) return
    preparingDocument.value = true
    try {
      const file = await documentAttachment()
      if (attachDocument.value) attachment.value = file
    } finally {
      preparingDocument.value = false
    }
  })

  const kind = computed(() => (reportDialogError.value ? 'error' : 'problem'))

  /** The body that would be sent, or `null` while the service would refuse it. */
  const report = computed(() => {
    if (!context.value) return null
    if (attachDocument.value && !attachment.value) return null
    return buildReport(
      {
        exceptions: reportDialogError.value,
        note: note.value,
        email: email.value,
        activity: includeActivity.value ? activity.value : null,
        attachments: attachment.value ? [attachment.value] : []
      },
      context.value
    )
  })

  const preview = computed(() => (report.value ? JSON.stringify(report.value, null, 2) : ''))
  const emailInvalid = computed(() => {
    const value = email.value.trim()
    return value !== '' && !v.is(v.pipe(v.string(), v.email()), value)
  })

  async function send(): Promise<void> {
    const body = report.value
    if (!body || sending.value) return
    sending.value = true
    failure.value = null
    try {
      const result = await sendReport(body, attachment.value ? [attachment.value] : [])
      if (!result.ok) {
        failure.value = result.failure
        return
      }
      reportDialogOpen.value = false
      toast.info(diagnosticsMessages.get().reportSent)
    } finally {
      sending.value = false
    }
  }

  return {
    kind,
    note,
    email,
    emailInvalid,
    includeActivity,
    attachDocument,
    hasDocument,
    preparingDocument,
    report,
    preview,
    sending,
    failure,
    send
  }
}
