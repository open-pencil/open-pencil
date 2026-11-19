import {
  createDefaultStackParser,
  DOMExceptionCoercer,
  ErrorCoercer,
  ErrorEventCoercer,
  ErrorPropertiesBuilder,
  EventCoercer,
  ObjectCoercer,
  PrimitiveCoercer,
  PromiseRejectionEventCoercer,
  StringCoercer,
  type Exception,
  type StackFrame
} from '@posthog/core/error-tracking'

import {
  REPORT_FRAMES_LIMIT,
  type ReportErrorSource,
  type ReportException,
  type ReportFrame
} from '@open-pencil/feedback/contract'

import { diagnosticErrorDetails, mayQuoteContent } from '@/app/diagnostics'
import { scrubDiagnosticText } from '@/app/diagnostics/scrub'

/** PostHog's own conversion, as its browser SDK sets it up; it also reads the injected chunk IDs. */
const builder = new ErrorPropertiesBuilder(
  [
    new DOMExceptionCoercer(),
    new PromiseRejectionEventCoercer(),
    new ErrorEventCoercer(),
    new ErrorCoercer(),
    new EventCoercer(),
    new ObjectCoercer(),
    new StringCoercer(),
    new PrimitiveCoercer()
  ],
  createDefaultStackParser()
)

const MAX_TYPE_LENGTH = 128
const MAX_VALUE_LENGTH = 1000
const MAX_FILENAME_LENGTH = 1024
const MAX_FUNCTION_LENGTH = 256
const MAX_EXCEPTIONS = 5
const CHUNK_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function position(value: number | undefined): number | undefined {
  return value !== undefined && Number.isInteger(value) && value >= 0 ? value : undefined
}

function toFrame(frame: StackFrame): ReportFrame {
  return {
    platform: 'web:javascript',
    filename: frame.filename && scrubDiagnosticText(frame.filename).slice(0, MAX_FILENAME_LENGTH),
    function: frame.function?.slice(0, MAX_FUNCTION_LENGTH),
    lineno: position(frame.lineno),
    colno: position(frame.colno),
    in_app: frame.in_app,
    chunk_id: frame.chunk_id && CHUNK_ID.test(frame.chunk_id) ? frame.chunk_id : undefined
  }
}

function toException(
  exception: Exception,
  value: string | undefined,
  source: ReportErrorSource
): ReportException {
  const frames = exception.stacktrace?.frames ?? []
  return {
    type: (exception.type || 'Error').slice(0, MAX_TYPE_LENGTH),
    value: value?.slice(0, MAX_VALUE_LENGTH),
    mechanism: {
      handled: exception.mechanism?.handled ?? false,
      synthetic: exception.mechanism?.synthetic ?? false,
      type: source
    },
    stacktrace:
      frames.length > 0
        ? { type: 'raw', frames: frames.slice(-REPORT_FRAMES_LIMIT).map(toFrame) }
        : undefined
  }
}

/** The error and the causes it chains, as far as a report follows them. */
function causeChain(error: unknown): unknown[] {
  const chain: unknown[] = []
  for (let link = error; link !== undefined && chain.length < MAX_EXCEPTIONS;) {
    if (chain.includes(link)) break
    chain.push(link)
    link = link instanceof Error ? link.cause : undefined
  }
  return chain
}

/**
 * An uncaught error, its causes included, as PostHog error tracking reads it. Messages are
 * scrubbed as the diagnostics log scrubs them; when any error in the chain may quote prompts or
 * responses, as provider errors do, no message in it is kept, only types and frames.
 */
export function reportExceptions(error: unknown, source: ReportErrorSource): ReportException[] {
  const exceptions = builder
    .buildFromUnknown(error, { mechanism: { handled: false } })
    .$exception_list.slice(0, MAX_EXCEPTIONS)
  const quotesContent = causeChain(error).some(
    (link) => link instanceof Error && mayQuoteContent(link)
  )
  const topMessage = diagnosticErrorDetails(error).message
  return exceptions.map((exception, index) => {
    if (quotesContent) return toException(exception, undefined, source)
    const value = index === 0 ? topMessage : exception.value && scrubDiagnosticText(exception.value)
    return toException(exception, value || undefined, source)
  })
}

/** Whether a frame of the error ran in OpenPencil's own code rather than an extension or a page script. */
export function isOwnError(exceptions: ReportException[], origin: string): boolean {
  return exceptions.some((exception) =>
    exception.stacktrace?.frames.some((frame) => frame.filename?.startsWith(`${origin}/`))
  )
}
