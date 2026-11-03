import * as v from 'valibot'
import { computed, ref, shallowRef, watch } from 'vue'

import { exportFigFile } from '@open-pencil/core/io/formats/fig'
import type { Build, ReportReceipt } from '@open-pencil/feedback/contract'
import { diagnosticsMessages } from '@open-pencil/vue/i18n'

import { diagnostics, type DiagnosticEvent } from '@/app/diagnostics'
import { useActiveEditorStoreRef, type EditorStore } from '@/app/editor/active-store'
import { appPreferences } from '@/app/settings/preferences/store'
import { toast } from '@/app/shell/ui'
import { showsDocument } from '@/app/tabs'
import { currentBuild } from '@/app/telemetry/build'
import { sharingState } from '@/app/telemetry/state'

import { buildReport, type ReportAttachment } from './build'
import { sendReport, type ReportSendFailure } from './send'
import {
  reportDialogError,
  reportDialogNotice,
  reportDialogOpen,
  reportDialogOpening
} from './state'

/** The install ID while usage stats are shared, read as it changes, also from another window. */
function sharedInstallId(): string | null {
  const shared = appPreferences.value.sharing.usageStats === 'granted'
  return shared ? sharingState.value.installId : null
}

/** The document in the active tab; Home and a New file tab hold none, as the File menu decides. */
const activeDocument = computed(() =>
  showsDocument() ? (useActiveEditorStoreRef().value ?? null) : null
)

/** A document as a `.fig` file under the name reports accept, never its own name. */
async function documentAttachment(store: EditorStore): Promise<ReportAttachment> {
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
  const hasDocument = computed(() => activeDocument.value !== null)
  const sending = ref(false)
  const failure = ref<ReportSendFailure | null>(null)
  const build = shallowRef<Build | null>(null)
  const activity = shallowRef<DiagnosticEvent[]>([])
  const attachment = shallowRef<ReportAttachment | null>(null)
  const preparingDocument = ref(false)
  const documentFailed = ref(false)
  /** Set once the report went through but a file did not, so Send uploads only the files. */
  const delivered = shallowRef<ReportReceipt | null>(null)
  let exportRequest = 0

  // Each opening resets the draft, also one that replaces a report still open.
  watch(
    reportDialogOpening,
    async () => {
      if (!reportDialogOpen.value) return
      note.value = ''
      email.value = ''
      includeActivity.value = true
      attachDocument.value = false
      attachment.value = null
      failure.value = null
      delivered.value = null
      sending.value = false
      activity.value = diagnostics.recent()
      build.value = await currentBuild()
    },
    { immediate: true }
  )

  // The attachment follows the active tab, so a tab switched to with the dialog open is the one sent.
  watch([attachDocument, activeDocument], async ([attach, store]) => {
    // Only the latest export counts: an earlier one may be of the tab that was active before.
    const request = ++exportRequest
    attachment.value = null
    documentFailed.value = false
    preparingDocument.value = attach && store !== null
    if (!attach || !store) return
    try {
      const file = await documentAttachment(store)
      if (request === exportRequest) attachment.value = file
    } catch {
      if (request === exportRequest) documentFailed.value = true
    } finally {
      if (request === exportRequest) preparingDocument.value = false
    }
  })

  // A changed report is a new one: sending it posts it rather than reusing a delivered receipt.
  watch([note, email, includeActivity, attachment], () => {
    delivered.value = null
  })

  const kind = computed(() => (reportDialogError.value ? 'error' : 'problem'))

  /** The body that would be sent, or `null` while the service would refuse it. */
  const report = computed(() => {
    if (!build.value) return null
    if (attachDocument.value && (!attachment.value || !hasDocument.value)) return null
    return buildReport(
      {
        exceptions: reportDialogError.value,
        note: note.value,
        email: email.value,
        activity: includeActivity.value ? activity.value : null,
        attachments: attachment.value ? [attachment.value] : []
      },
      { build: build.value, installId: sharedInstallId() }
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
    // A send that ends after the dialog opened again leaves the newer report alone.
    const opening = reportDialogOpening.value
    const notice = reportDialogNotice.value
    const current = () => opening === reportDialogOpening.value
    sending.value = true
    failure.value = null
    try {
      const result = await sendReport(body, attachment.value ? [attachment.value] : [], {
        delivered: delivered.value
      })
      if (!result.ok) {
        if (!current()) return
        failure.value = result.failure
        if (result.failure === 'files') delivered.value = result.receipt
        return
      }
      // The notice that offered this report would only offer it again.
      if (notice) toast.removeOffer(notice.toastId, notice.action)
      toast.info(diagnosticsMessages.get().reportSent)
      if (current()) reportDialogOpen.value = false
    } finally {
      if (current()) sending.value = false
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
    documentFailed,
    report,
    preview,
    sending,
    failure,
    send
  }
}
