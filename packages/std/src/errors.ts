/** What went wrong, as text: an `Error`'s message, or anything else thrown as a string. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** `error` itself when it is an `Error`, otherwise an `Error` whose message is what was thrown. */
export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

/**
 * Whether `error` reports a cancellation: an aborted signal, or a person dismissing a picker or
 * share sheet, which browsers report as a `DOMException` named `AbortError`.
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}
