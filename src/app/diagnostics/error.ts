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
