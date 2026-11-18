import { ref, shallowRef } from 'vue'

import type { ReportErrorSource, ReportException } from '@open-pencil/feedback/contract'
import { diagnosticsMessages } from '@open-pencil/vue/i18n'

import type { ToastAction } from '@/app/shell/ui'
import { FEEDBACK_ENABLED } from '@/app/telemetry/config'

import { isOwnError, reportExceptions } from './exception'

/** Only official builds send reports, as only they send anything; others never offer it. */
export const REPORTS_ENABLED = FEEDBACK_ENABLED

export const reportDialogOpen = ref(false)
/** The error the open dialog reports, or `null` for a problem the person describes. */
export const reportDialogError = shallowRef<ReportException[] | null>(null)
/** A toast that offered a report, and the action on it that did. */
export interface ReportNotice {
  toastId: number
  action: ToastAction
}

/** The notice that offered the open report, which goes away once the report is sent. */
export const reportDialogNotice = shallowRef<ReportNotice | null>(null)
/** Counts the dialog's openings, so a send that ends after a newer one opened leaves it alone. */
export const reportDialogOpening = ref(0)

/**
 * Opens the report dialog, for a caught error or, without one, for a problem the person
 * describes; `notice` is the toast that offered it.
 */
export function openReportDialog(
  exceptions: ReportException[] | null = null,
  notice: ReportNotice | null = null
): void {
  reportDialogError.value = exceptions
  reportDialogNotice.value = notice
  reportDialogOpening.value++
  reportDialogOpen.value = true
}

/** A toast action that opens the report dialog for `exceptions`. */
export function reportAction(exceptions: ReportException[]): ToastAction {
  const action: ToastAction = {
    label: diagnosticsMessages.get().reportError,
    run: (toastId) => openReportDialog(exceptions, { toastId, action })
  }
  return action
}

/**
 * The Report action for an uncaught error's notice, or none when this build sends nothing or the
 * error came from an extension or a page script rather than OpenPencil. The stack is read now,
 * while the code that threw is still the code running.
 */
export function reportErrorAction(
  error: unknown,
  source: ReportErrorSource
): ToastAction | undefined {
  if (!REPORTS_ENABLED) return undefined
  const exceptions = reportExceptions(error, source)
  if (!isOwnError(exceptions, location.origin)) return undefined
  return reportAction(exceptions)
}
