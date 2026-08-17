export type AIChatFailureReason = 'insufficient-credit' | 'output-limit' | 'request-failed'

export type AIChatFailure = {
  reason: AIChatFailureReason
  detail?: string
}

export type ProviderErrorShape = {
  statusCode?: unknown
  status?: unknown
  responseStatusCode?: unknown
  responseStatus?: unknown
  code?: unknown
  response?: { status?: unknown }
}

function statusNumber(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
  return null
}

export function providerErrorStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null
  const value = error as ProviderErrorShape
  return (
    statusNumber(value.statusCode) ??
    statusNumber(value.status) ??
    statusNumber(value.responseStatusCode) ??
    statusNumber(value.responseStatus) ??
    statusNumber(value.code) ??
    statusNumber(value.response?.status)
  )
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function isInsufficientCreditError(error: unknown): boolean {
  if (providerErrorStatus(error) === 402) return true
  const text = errorText(error).toLowerCase()
  return [
    'insufficient credit',
    'insufficient balance',
    'insufficient quota',
    'credit balance',
    'payment required',
    'quota exceeded',
    'billing quota',
    'top up',
    'top-up'
  ].some((phrase) => text.includes(phrase))
}

export function classifyAIChatFinish(finishReason?: string): AIChatFailure | null {
  return finishReason === 'length' ? { reason: 'output-limit' } : null
}

export function classifyAIChatError(error: unknown): AIChatFailure {
  return {
    reason: isInsufficientCreditError(error) ? 'insufficient-credit' : 'request-failed',
    detail: errorText(error)
  }
}
