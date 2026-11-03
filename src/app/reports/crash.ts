import { invoke } from '@tauri-apps/api/core'
import { useLocalStorage } from '@vueuse/core'
import * as v from 'valibot'

import { REPORT_ERROR_SOURCES, type ReportException } from '@open-pencil/feedback/contract'
import { diagnosticsMessages } from '@open-pencil/vue/i18n'

import { diagnostics, type DiagnosticEvent } from '@/app/diagnostics'
import { scrubDiagnosticText } from '@/app/diagnostics/scrub'
import { crashedSessionsOf } from '@/app/document/recovery/session'
import { startedSessionIds } from '@/app/document/recovery/session/storage'
import { APP_VERSION } from '@/app/runtime/version'
import { toast } from '@/app/shell/ui'
import { IS_TAURI } from '@/constants'

import { reportExceptions } from './exception'
import { openReportDialog, REPORTS_ENABLED } from './state'

/** Read as the app launches, before recovery forgets the crashed sessions it has no copies of. */
const startedAtLaunch = startedSessionIds()

const MAX_REMEMBERED = 50

/** Crashed sessions already offered, so each crash is offered once whatever is chosen. */
const offeredSessions = useLocalStorage<string[]>('open-pencil:reports:offered-crashes', [])

const panicSchema = v.object({
  message: v.string(),
  location: v.nullable(v.string()),
  version: v.string()
})

const runtimeErrorSchema = v.object({
  source: v.picklist(REPORT_ERROR_SOURCES),
  errorName: v.string(),
  message: v.nullable(v.string()),
  stack: v.nullable(v.string()),
  appSession: v.string(),
  appVersion: v.string()
})
type RuntimeError = v.InferOutput<typeof runtimeErrorSchema>

/** A Rust panic as one exception; it has no JavaScript frames, only where in the source it was. */
export function panicExceptions(panic: v.InferOutput<typeof panicSchema>): ReportException[] {
  const where = panic.location ? ` (${panic.location})` : ''
  return [
    {
      type: 'panic',
      value: scrubDiagnosticText(`${panic.message}${where}`).slice(0, 1000),
      mechanism: { handled: false, synthetic: false, type: 'panic' }
    }
  ]
}

/** The error a crashed session last logged, rebuilt from its scrubbed message and stack. */
export function storedErrorExceptions(error: RuntimeError): ReportException[] {
  const rebuilt = new Error(error.message ?? '')
  rebuilt.name = error.errorName
  if (error.stack) rebuilt.stack = error.stack
  return reportExceptions(rebuilt, error.source)
}

/**
 * The last error each crashed session logged under this build, most recent first. An error from
 * another build would point at chunks this one does not have.
 */
export function crashErrors(
  events: readonly DiagnosticEvent[],
  crashed: ReadonlySet<string>
): (RuntimeError & { at: number })[] {
  const errors = events.flatMap((event) => {
    if (event.name !== 'runtime.error') return []
    const parsed = v.safeParse(runtimeErrorSchema, event.attributes)
    if (!parsed.success || parsed.output.appVersion !== APP_VERSION) return []
    return crashed.has(parsed.output.appSession) ? [{ ...parsed.output, at: event.timestamp }] : []
  })
  return errors.toSorted((a, b) => b.at - a.at)
}

function offer(message: string, exceptions: ReportException[]): void {
  toast.error(message, {
    label: diagnosticsMessages.get().reportError,
    run: (toastId) => openReportDialog(exceptions, toastId)
  })
}

async function lastPanic() {
  if (!IS_TAURI) return null
  const answer: unknown = await invoke('take_last_panic').catch(() => null)
  const parsed = v.safeParse(v.nullable(panicSchema), answer)
  return parsed.success && parsed.output?.version === APP_VERSION ? parsed.output : null
}

/**
 * On launch, offers to report what ended the last run: a desktop panic, or the last error of a
 * window whose run ended without the window closing, such as a crash or a killed process. Nothing is
 * sent unless the person opens the report and sends it.
 */
export async function offerCrashReports(): Promise<void> {
  if (!REPORTS_ENABLED) return
  const messages = diagnosticsMessages.get()
  const panic = await lastPanic()
  if (panic) offer(messages.reportPanic, panicExceptions(panic))

  const offered = new Set(offeredSessions.value)
  const crashed = new Set(
    [...(await crashedSessionsOf(startedAtLaunch))].filter((id) => !offered.has(id))
  )
  if (crashed.size === 0) return
  offeredSessions.value = [...offeredSessions.value, ...crashed].slice(-MAX_REMEMBERED)
  const last = crashErrors(await diagnostics.list(), crashed).at(0)
  if (last) offer(messages.reportCrashed, storedErrorExceptions(last))
}
