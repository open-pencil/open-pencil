import { REDACTED, scrubDiagnosticText } from './scrub'

export type DiagnosticErrorInfo = {
  errorName: string
  errorCode: string | null
  retryable: boolean | null
}

function isRetryableError(error: unknown): boolean | null {
  if (!(error instanceof Error)) return null
  if (error.name === 'AbortError') return false
  if ('status' in error && typeof error.status === 'number') {
    return error.status === 408 || error.status === 429 || error.status >= 500
  }
  return null
}

export function describeDiagnosticError(error: unknown): DiagnosticErrorInfo {
  if (!(error instanceof Error)) {
    return { errorName: 'UnknownError', errorCode: null, retryable: null }
  }
  const code = 'code' in error && typeof error.code === 'string' ? error.code : null
  return { errorName: error.name || 'Error', errorCode: code, retryable: isRetryableError(error) }
}

export type DiagnosticErrorDetails = DiagnosticErrorInfo & {
  message: string | null
  stack: string | null
}

const MAX_MESSAGE_LENGTH = 500
const MAX_STACK_LINES = 25
const MAX_STACK_LENGTH = 4000

/**
 * AI SDK and provider errors (`AI_APICallError`, `AI_InvalidPromptError`, …) and errors that
 * carry a response can quote prompts, responses, or request URLs in their message.
 */
function mayQuoteContent(error: Error): boolean {
  return error.name.startsWith('AI_') || 'responseBody' in error || 'requestBodyValues' in error
}

/**
 * Errors the engine raises on its own bugs, such as `x.map is not a function`. Their messages
 * name code, not content, unlike the errors a tool throws on purpose, which quote its input.
 */
export function isInternalError(error: unknown): error is Error {
  return (
    error instanceof TypeError || error instanceof ReferenceError || error instanceof RangeError
  )
}

/**
 * The metadata of `describeDiagnosticError`, plus the message and stack of a runtime failure,
 * scrubbed by `scrubDiagnosticText` and bounded in length.
 * A provider error keeps its stack but not its message, which can quote user content; V8 and
 * Bun repeat the message on the stack's first line, so it is removed there too.
 */
export function diagnosticErrorDetails(error: unknown): DiagnosticErrorDetails {
  const info = describeDiagnosticError(error)
  if (!(error instanceof Error)) {
    return {
      ...info,
      message: typeof error === 'string' ? storedMessage(error) : null,
      stack: null
    }
  }
  if (!mayQuoteContent(error)) {
    return {
      ...info,
      message: storedMessage(error.message),
      stack: error.stack ? storedStack(error.stack) : null
    }
  }
  const stack = error.message ? error.stack?.replaceAll(error.message, REDACTED) : error.stack
  return { ...info, message: null, stack: stack ? storedStack(stack) : null }
}

function storedMessage(message: string): string | null {
  return scrubDiagnosticText(message).slice(0, MAX_MESSAGE_LENGTH) || null
}

function storedStack(stack: string): string {
  const lines = scrubDiagnosticText(stack).split('\n').slice(0, MAX_STACK_LINES)
  return lines.join('\n').slice(0, MAX_STACK_LENGTH)
}
